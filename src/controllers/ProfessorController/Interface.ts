import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import professorEntity from './Entity.js';
import { getPaginatedSchema, paginationQuerySchema, PaginationQueryType } from '../../pagination.js';

extendZodWithOpenApi(z);

const professorBase = z.object({
	id: z.number().int(),
	name: z.string().min(1),
}).strict();

const createProfessorBody = professorBase.omit({ id: true }).openapi('CreateProfessorBody');

const patchProfessorBody = professorBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchProfessorBody');

const listProfessorsQuery = paginationQuerySchema.extend({
	classId: z.coerce.number().int().optional(),
}).openapi('ListProfessorsQuery');

const PageProfessorsSchema = getPaginatedSchema(professorEntity.schema).openapi('PageProfessors');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(professorEntity.schema, "Professor retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: listProfessorsQuery,
	}),
	output: new OutputBuilder()
		.ok(PageProfessorsSchema, "List of professors retrieved successfully")
		.badRequest()
		.build(),
}

const create = {
	input: z.object({
		body: createProfessorBody.strict(),
	}),
	output: new OutputBuilder()
		.created(professorEntity.schema, "Professor created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchProfessorBody,
	}),
	output: new OutputBuilder()
		.ok(professorEntity.schema, "Professor updated successfully")
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
		.noContent("Professor deleted successfully")
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
	classId?: number;
} & Partial<PaginationQueryType>;
