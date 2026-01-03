import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../../BuildHandler.js';
import curriculumCourseEntity from './Entity.js';

extendZodWithOpenApi(z);

const curriculumCourseBase = z.object({
	curriculumId: z.number().int(),
	courseId: z.number().int(),
	semester: z.number().int().nullable(),
}).strict();

const addCourse = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			cid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: curriculumCourseBase.omit({ curriculumId: true }),
	}),
	output: new OutputBuilder()
		.created(curriculumCourseEntity.schema, "Course added to curriculum successfully")
		.badRequest()
		.notFound()
		.build(),
}

const updateCourse = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			cid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			courseId: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: curriculumCourseBase.omit({ curriculumId: true, courseId: true }).partial(),
	}),
	output: new OutputBuilder()
		.ok(curriculumCourseEntity.schema, "Course updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const removeCourse = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			cid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			courseId: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Course removed from curriculum successfully")
		.notFound()
		.build(),
}

export default {
	addCourse,
	updateCourse,
	removeCourse
}
