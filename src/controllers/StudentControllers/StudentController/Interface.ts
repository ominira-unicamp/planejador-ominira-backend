import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../../BuildHandler.js';
import studentEntity from './Entity.js';

extendZodWithOpenApi(z);

const studentBase = z.object({
	id: z.number().int(),
	ra: z.string(),
	name: z.string(),
	programId: z.number().int().nullable().optional(),
	modalityId: z.number().int().nullable().optional(),
	catalogId: z.number().int().nullable().optional(),
}).strict();

const createStudentBody = studentBase.omit({ id: true }).openapi('CreateStudentBody');

const patchStudentBody = studentBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchStudentBody');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(studentEntity.schema, "Student retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({}),
	output: new OutputBuilder()
		.ok(z.array(studentEntity.schema), "List of students retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: createStudentBody,
	}),
	output: new OutputBuilder()
		.created(studentEntity.schema, "Student created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchStudentBody,
	}),
	output: new OutputBuilder()
		.ok(studentEntity.schema, "Student updated successfully")
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
		.noContent("Student deleted successfully")
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
