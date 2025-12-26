import { Router } from 'express'
import type { Request, Response } from "express";
import prisma from '../PrismaClient'
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import ResponseBuilder from '../ResponseBuilder';
import { ZodErrorResponse } from '../Validation';

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const roomEntity = z.object({
    id: z.number().int(),
    code: z.string(),
    _paths: z.object({
        entity: z.string(),
    })
}).strict().openapi('RoomEntity');

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
		const entities : z.infer<typeof roomEntity>[] = rooms.map((room) => ({
            ...room,
            _paths: {
                entity: entityPath(room.id),
            }
        }))
		res.json(entities)
	})
}
router.get('/rooms', list)



registry.registerPath({
    method: 'get',
    path: '/rooms/:id',
    tags: ['room'],
    responses: new ResponseBuilder()
        .ok(roomEntity, "A room by id")
        .badRequest()
        .notFound()
        .internalServerError()
        .build(),
});

async function get(req: Request, res: Response) {
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["params", "id"], error));
		return;
	}
    prisma.room.findUnique({
		where: {
			id: id,
		},
	}).then((room) => {
		if (!room) {
			res.status(404).json({ error: "Room not found" });
			return;
		}
		const entity : z.infer<typeof roomEntity> = {
			...room,
			_paths: {
				entity: entityPath(room.id),
			}
		}
		res.json(entity)
	})
}
router.get('/rooms/:id', get)


function entityPath(roomId: number) {
	return `/rooms/${roomId}`;
}
export default {
	router,
    registry,
    paths: {
        entity: entityPath,
    },
}
