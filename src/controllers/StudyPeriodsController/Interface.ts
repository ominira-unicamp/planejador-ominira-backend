import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import studyPeriodEntity from './Entity.js';

extendZodWithOpenApi(z);

const studyPeriodBase = z.object({
	id: z.number().int(),
	code: z.string(),
	startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
}).strict();
 

const createStudyPeriodBody = studyPeriodBase.omit({ id: true }).openapi('CreateStudyPeriodBody');

const patchStudyPeriodBody = studyPeriodBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchStudyPeriodBody');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(studyPeriodEntity.schema, "Study period retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({}),
	output: new OutputBuilder()
		.ok(z.array(studyPeriodEntity.schema), "List of study periods retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: createStudyPeriodBody.strict(),
	}),
	output: new OutputBuilder()
		.created(studyPeriodEntity.schema, "Study period created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchStudyPeriodBody,
	}),
	output: new OutputBuilder()
		.ok(studyPeriodEntity.schema, "Study period patched successfully")
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
		.noContent("Study period deleted successfully")
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

