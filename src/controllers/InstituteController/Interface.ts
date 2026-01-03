import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import instituteEntity from './Entity.js';

extendZodWithOpenApi(z);

const instituteBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
}).strict();

const createInstituteBody = instituteBase.omit({ id: true }).openapi('CreateInstituteBody');

const patchInstituteBody = instituteBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchInstituteBody');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(instituteEntity.schema, "Institute retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({}),
	output: new OutputBuilder()
		.ok(z.array(instituteEntity.schema), "List of institutes retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: createInstituteBody.strict(),
	}),
	output: new OutputBuilder()
		.created(instituteEntity.schema, "Institute created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchInstituteBody,
	}),
	output: new OutputBuilder()
		.ok(instituteEntity.schema, "Institute updated successfully")
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
		.noContent("Institute deleted successfully")
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
