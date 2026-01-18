import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../../BuildHandler.js';
import curriculumEntity from './Entity.js';

extendZodWithOpenApi(z);

const curriculumBase = z.object({
	id: z.number().int(),
	studentId: z.number().int(),
}).strict();

const get = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(curriculumEntity.schema, "Curriculum retrieved successfully")
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
		.ok(z.array(curriculumEntity.schema), "List of curricula retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.created(curriculumEntity.schema, "Curriculum created successfully")
		.badRequest()
		.build(),
}
const curriculumCourse = z.object({
	courseId: z.number().int(),
	semester: z.number().int().nullable(),
});
const patch = {
	input: z.object({
		path: z.object({
			sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			id: z.number().int(),
			studentId: z.number().int(),
			courses: z.object({
				update: z.array(curriculumCourse),
				set: z.array(curriculumCourse),
				add: z.array(curriculumCourse),
				upsert: z.array(curriculumCourse),
				remove: z.array(z.number().int()),
			}).partial(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(curriculumEntity.schema, "Curriculum updated successfully")
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
		.noContent("Curriculum deleted successfully")
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
