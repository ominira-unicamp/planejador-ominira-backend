import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler } from '../../defaultEndpoint.js';
import roomEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, Context, HandlerFn } from '../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/rooms');
authRegistry.addException('GET', '/rooms/:id');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const rooms = await ctx.prisma.room.findMany();
	const entities = rooms.map(roomEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.room,
	{},
	roomEntity.build,
	"Room not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body } = input;
	const existing = await ctx.prisma.room.findUnique({ where: { code: body.code } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "code"],
				message: "A room with this code already exists"
			}])
		};
	}
	const room = await ctx.prisma.room.create({
		data: {
			code: body.code,
		},
	});
	return { 201: roomEntity.build(room) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	const existing = await ctx.prisma.room.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Room not found" } };

	if (body.code !== undefined) {
		const codeExists = await ctx.prisma.room.findUnique({ where: { code: body.code } });
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

	const room = await ctx.prisma.room.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
		},
	});
	return { 200: roomEntity.build(room) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	const existing = await ctx.prisma.room.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Room not found" } };
	await ctx.prisma.room.delete({ where: { id } });
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
