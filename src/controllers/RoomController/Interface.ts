import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import roomEntity from './Entity.js';

extendZodWithOpenApi(z);

const roomBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
}).strict();

const createRoomBody = roomBase.omit({ id: true }).openapi('CreateRoomBody');

const patchRoomBody = roomBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchRoomBody');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(roomEntity.schema, "Room retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({}),
	output: new OutputBuilder()
		.ok(z.array(roomEntity.schema), "List of rooms retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: createRoomBody.strict(),
	}),
	output: new OutputBuilder()
		.created(roomEntity.schema, "Room created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchRoomBody,
	}),
	output: new OutputBuilder()
		.ok(roomEntity.schema, "Room updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Room deleted successfully")
		.notFound()
		.build(),
}

export default {
	get,
	list,
	create,
	patch,
	remove
}
