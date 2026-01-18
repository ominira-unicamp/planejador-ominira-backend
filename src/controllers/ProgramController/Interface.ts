import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import programEntity from './Entity.js';

extendZodWithOpenApi(z);

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(programEntity.schema, "Program retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: z.object({
			instituteId: z.string().pipe(z.coerce.number()).pipe(z.number().int()).optional(),
		}),
	}),
	output: new OutputBuilder()
		.ok(z.array(programEntity.schema), "List of programs retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: z.object({
			code: z.number().int().positive(),
			name: z.string().min(1),
			instituteId: z.number().int(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(programEntity.schema, "Program created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			code: z.number().int().positive().optional(),
			name: z.string().min(1).optional(),
			instituteId: z.number().int().optional(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(programEntity.schema, "Program updated successfully")
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
		.noContent("Program deleted successfully")
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
