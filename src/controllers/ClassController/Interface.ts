import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import classEntity from './Entity.js';
import { getPaginatedSchema, paginationQuerySchema, PaginationQueryType } from '../../pagination.js';

extendZodWithOpenApi(z);

const classBaseSchema = z.object({
	id: z.number().int(),
	code: z.string().min(1),
	reservations: z.array(z.number().int()),
	courseId: z.number().int(),
	studyPeriodId: z.number().int(),
	professorIds: z.array(z.number().int()),
}).strict();

const createClassBody = classBaseSchema.omit({ id: true }).openapi('CreateClassBody');

const patchClassBody = classBaseSchema
	.partial()
	.openapi('PatchClassBody');

const listClassesQuery = paginationQuerySchema.extend({
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	studyPeriodId: z.coerce.number().int().optional(),
	studyPeriodCode: z.string().optional(),
	professorId: z.coerce.number().int().optional(),
	professorName: z.string().optional(),
}).openapi('GetClassesQuery');

const PageClassesSchema = getPaginatedSchema(classEntity.schema);

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(classEntity.schema, "Class retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: listClassesQuery,
	}),
	output: new OutputBuilder()
		.ok(PageClassesSchema, "List of classes retrieved successfully")
		.badRequest()
		.build(),
}

const create = {
	input: z.object({
		body: createClassBody.strict(),
	}),
	output: new OutputBuilder()
		.created(classEntity.schema, "Class created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchClassBody,
	}),
	output: new OutputBuilder()
		.ok(classEntity.schema, "Class updated successfully")
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
		.noContent("Class deleted successfully")
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

export type ListQueryParams = {
	instituteId?: number | undefined,
	courseId?: number | undefined,
	studyPeriodId?: number | undefined,
	professorId?: number | undefined
} & Partial<PaginationQueryType>;
