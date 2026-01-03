import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { getPaginatedSchema, paginationQuerySchema, PaginationQueryType } from '../../pagination.js';
import courseEntity from './Entity.js';
import { OutputBuilder } from '../../BuildHandler.js';
extendZodWithOpenApi(z);

const courseBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
	name: z.string().min(1),
	credits: z.number().int().min(0),
	instituteId: z.number().int(),
});

const listCourseQuery = paginationQuerySchema.extend({
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().min(1).optional(),
}).openapi('ListCoursesQuery');

const PageCoursesSchema = getPaginatedSchema(courseEntity.schema).openapi('PageCourses');

const get = {
	input: z.object({
		path: z.object({
			id: z.coerce.number().int(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(courseEntity.schema, "Course retrieved successfully")
		.notFound()
		.build(),
}
const list = {
	input: z.object({
		query: listCourseQuery,
	}),
	output: new OutputBuilder()
		.ok(PageCoursesSchema, "List of courses retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: courseBase.omit({ id: true }).strict().openapi('CreateCourseBody'),
	}),
	output: new OutputBuilder()
		.created(courseEntity.schema, "Course created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}).strict(),
		body: courseBase.omit({ id: true }).partial().strict().openapi('PatchCourseBody')
	}),
	output: new OutputBuilder()
		.ok(courseEntity.schema, "Course patched successfully")
		.notFound()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			id: z.coerce.number().int(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.noContent("Course deleted successfully")
		.notFound()
		.build(),
}


export default {
	list,
	create,
	patch,
	remove,
}
