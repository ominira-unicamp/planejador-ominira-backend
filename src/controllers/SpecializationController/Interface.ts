import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import specializationEntity from './Entity.js';

extendZodWithOpenApi(z);

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(specializationEntity.schema, "Specialization retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: z.object({}),
	}),
	output: new OutputBuilder()
		.ok(z.array(specializationEntity.schema), "List of specializations retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: z.object({
			code: z.string().min(1),
			name: z.string().min(1),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(specializationEntity.schema, "Specialization created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			code: z.string().min(1).optional(),
			name: z.string().min(1).optional(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(specializationEntity.schema, "Specialization updated successfully")
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
		.noContent("Specialization deleted successfully")
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
