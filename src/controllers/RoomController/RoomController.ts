import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../../PrismaClient.js'
import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler } from '../../defaultEndpoint.js';
import roomEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler } from '../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/rooms');
authRegistry.addException('GET', '/rooms/:id');

async function listFn(input: z.infer<typeof IO.list.input>): Promise<z.infer<typeof IO.list.output>> {
	const rooms = await prisma.room.findMany();
	const entities = rooms.map(roomEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	prisma.room,
	{},
	roomEntity.build,
	"Room not found"
);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { body } = input;
	const existing = await prisma.room.findUnique({ where: { code: body.code } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "code"],
				message: "A room with this code already exists"
			}])
		};
	}
	const room = await prisma.room.create({
		data: {
			code: body.code,
		},
	});
	return { 201: roomEntity.build(room) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	const existing = await prisma.room.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Room not found" } };

	if (body.code !== undefined) {
		const codeExists = await prisma.room.findUnique({ where: { code: body.code } });
		if (codeExists && codeExists.id !== id) {
			return {
				400: new ValidationError([{
					code: "ALREADY_EXISTS",
					path: ["body", "code"],
					message: "A room with this code already exists"
				}])
			};
		}
	}

	const room = await prisma.room.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
		},
	});
	return { 200: roomEntity.build(room) };
}

async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.room.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Room not found" } };
	await prisma.room.delete({ where: { id } });
	return { 204: null };
}

router.get('/rooms/:id', get);

router.get('/rooms', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/rooms', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/rooms/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/rooms/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

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
