import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../../BuildHandler.js';
import studentCourseEntity, { statusSchema } from './Entity.js';
import { StudentCourseStatus } from '../../../../prisma/generated/client.js';

extendZodWithOpenApi(z);

const studentCourseBase = z.object({
	studentId: z.number().int(),
	courseId: z.number().int(),
	status: z.enum(StudentCourseStatus),
}).strict();

const get = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			courseId: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(studentCourseEntity.schema, "Student course retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		query: z.object({
			status: statusSchema.optional(),
		}),
	}),
	output: new OutputBuilder()
		.ok(z.array(studentCourseEntity.schema), "List of student courses retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			courseId: z.number().int(),
			status: z.enum(StudentCourseStatus).default(StudentCourseStatus.ENROLLED),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(studentCourseEntity.schema, "Student course created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			courseId: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			status: statusSchema,
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(studentCourseEntity.schema, "Student course updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			courseId: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Student course deleted successfully")
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
