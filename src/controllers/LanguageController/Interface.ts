import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import languageEntity from './Entity.js';

extendZodWithOpenApi(z);

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(languageEntity.schema, "Language retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: z.object({}),
	}),
	output: new OutputBuilder()
		.ok(z.array(languageEntity.schema), "List of languages retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: z.object({
			name: z.string().min(1),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(languageEntity.schema, "Language created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			name: z.string().min(1),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(languageEntity.schema, "Language updated successfully")
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
		.noContent("Language deleted successfully")
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
