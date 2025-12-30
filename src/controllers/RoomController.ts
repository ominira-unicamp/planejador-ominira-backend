import { Router } from 'express'
import type { Request, Response } from "express";
import prisma, { MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { ValidationError, ZodToApiError } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { defaultGetHandler, defaultOpenApiGetPath } from '../defaultEndpoint';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

type PrismaRoomPayload = MyPrisma.RoomGetPayload<{}>;

function buildRoomEntity(room: PrismaRoomPayload): z.infer<typeof roomEntity> {
	return {
		...room,
		_paths: {
			entity: entityPath(room.id),
		}
	};
}

const roomBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
});

const roomEntity = roomBase.extend({
    id: z.number().int(),
    code: z.string(),
    _paths: z.object({
        entity: z.string(),
    })
}).strict().openapi('RoomEntity');

authRegistry.addException('GET', '/rooms');
registry.registerPath({
    method: 'get',
    path: '/rooms',
    tags: ['room'],
    responses: new ResponseBuilder()
        .ok(z.array(roomEntity), "A list of rooms")
        .internalServerError()
        .build(),
});

async function list(req: Request, res: Response) {
    prisma.room.findMany().then((rooms) => {
		const entities : z.infer<typeof roomEntity>[] = rooms.map((room) => buildRoomEntity(room));
		res.json(entities)
	})
}
router.get('/rooms', list)



authRegistry.addException('GET', '/rooms/:id');
registry.registerPath(defaultOpenApiGetPath('/rooms/{id}', 'room', roomEntity, "A room by id"));
router.get('/rooms/:id', defaultGetHandler(
	prisma.room,
	{},
	buildRoomEntity,
	"Room not found"
))


const createRoomBody = roomBase.omit({ id: true }).strict().openapi('CreateRoomBody');

registry.registerPath({
	method: 'post',
	path: '/rooms',
	tags: ['room'],
	request: new RequestBuilder()
		.body(createRoomBody, "Room to create")
		.build(),
	responses: new ResponseBuilder()
		.created(roomEntity, "Room created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createRoomBody.safeParse(req.body);
	const errors = new ValidationError([]);
	if (!success) {
		errors.addErrors(ZodToApiError(error, ['body']));
	}
	
	if (body) {
		const existing = await prisma.room.findUnique({ where: { code: body.code } });
		if (existing) {
			errors.addError({
				code: "ALREADY_EXISTS",
				path: ['body', 'code'],
				message: 'A room with this code already exists'
			});
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const room = await prisma.room.create({
		data: body,
	});

	res.status(201).json(buildRoomEntity(room));
}
router.post('/rooms', create)


const patchRoomBody = roomBase.omit({ id: true }).partial().strict().openapi('PatchRoomBody');

registry.registerPath({
	method: 'patch',
	path: '/rooms/{id}',
	tags: ['room'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchRoomBody, "Room fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(roomEntity, "Room updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, data, error } = z.object({
		params: z.object({ id: z.coerce.number().int() }).strict(),
		body: patchRoomBody,
	}).safeParse(req);
	const validation = new ValidationError(ZodToApiError(error));
	if (success) {
		const existing = await prisma.room.findUnique({ where: { code: data.body.code } });
		if (existing && existing.id !== data.params.id) {
			validation.addError({
				code: "ALREADY_EXISTS",
				path: ['body', 'code'],
				message: 'A room with this code already exists'
			});
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}

	const existing = await prisma.room.findUnique({ where: { id: data.params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Room not found' });
		return;
	}

	const room = await prisma.room.update({
		where: { id: data.params.id },
		data: {
			...(data.body.code !== undefined && { code: data.body.code }),
		},
	});

	res.json(buildRoomEntity(room));
}
router.patch('/rooms/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/rooms/{id}',
	tags: ['room'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.build(),
	responses: new ResponseBuilder()
		.noContent()
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function deleteRoom(req: Request, res: Response) {
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(error);
		return;
	}
	const existing = await prisma.room.findUnique({ where: { id: id } });
	if (!existing) {
		res.status(404).json({ error: 'Room not found' });
		return;
	}

	await prisma.room.delete({ where: { id } });
	res.status(204).send();
}
router.delete('/rooms/:id', deleteRoom)

function entityPath(roomId: number) {
	return `/rooms/${roomId}`;
}
export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
