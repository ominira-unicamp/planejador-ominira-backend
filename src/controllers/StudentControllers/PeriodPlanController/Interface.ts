import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../../BuildHandler.js';
import periodPlanningEntity from './Entity.js';

extendZodWithOpenApi(z);

const periodPlanningBase = z.object({
	id: z.number().int(),
	studentId: z.number().int(),
	studyPeriodId: z.number().int(),
}).strict();

const get = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(periodPlanningEntity.schema, "Period planning retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(z.array(periodPlanningEntity.schema), "List of period plannings retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			studyPeriodId: z.number().int(),
			classes: z.array(z.number().int()).transform((arr) => new Set(arr)),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(periodPlanningEntity.schema, "Period planning created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			classes: z.object({
				set: z.array(z.number().int()).transform((arr) => new Set(arr)),
				add: z.array(z.number().int()).transform((arr) => new Set(arr)),
				remove: z.array(z.number().int()).transform((arr) => new Set(arr)),
			}).partial(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(periodPlanningEntity.schema, "Period planning updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Period planning deleted successfully")
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
