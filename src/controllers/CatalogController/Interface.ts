import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import catalogEntity from './Entity.js';

extendZodWithOpenApi(z);

const catalogBase = z.object({
	id: z.number().int(),
	year: z.number().int(),
}).strict();

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(catalogEntity.schema, "Catalog retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: z.object({
			year: z.string().pipe(z.coerce.number()).pipe(z.number().int()).optional(),
		}),
	}),
	output: new OutputBuilder()
		.ok(z.array(catalogEntity.schema), "List of catalogs retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: z.object({
			year: z.number().int().min(1900).max(2100),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(catalogEntity.schema, "Catalog created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			year: z.number().int().min(1900).max(2100),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(catalogEntity.schema, "Catalog updated successfully")
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
		.noContent("Catalog deleted successfully")
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
