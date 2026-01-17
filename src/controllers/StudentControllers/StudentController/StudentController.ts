import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../../auth.js';
import { ValidationError } from '../../../Validation.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import studentEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, type HandlerFn } from '../../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const students = await ctx.prisma.student.findMany();
	const entities = students.map(studentEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.student,
	{},
	studentEntity.build,
	"Student not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body } = input;
	const existing = await ctx.prisma.student.findFirst({ where: { ra: body.ra } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "ra"],
				message: "A student with this RA already exists"
			}])
		};
	}
	const student = await ctx.prisma.student.create({
		data: {
			ra: body.ra,
			name: body.name,
			programId: body.programId,
			specializationId: body.specializationId,
			catalogId: body.catalogId,
		},
	});
	return { 201: studentEntity.build(student) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	const existing = await ctx.prisma.student.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Student not found" } };

	const student = await ctx.prisma.student.update({
		where: { id },
		data: {
			...(body.ra !== undefined && { ra: body.ra }),
			...(body.name !== undefined && { name: body.name }),
			...(body.programId !== undefined && { programId: body.programId }),
			...(body.specializationId !== undefined && { specializationId: body.specializationId }),
			...(body.catalogId !== undefined && { catalogId: body.catalogId }),
		},
	});
	return { 200: studentEntity.build(student) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	const existing = await ctx.prisma.student.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Student not found" } };
	await ctx.prisma.student.delete({ where: { id } });
	return { 204: null };
}

router.get('/students/:id', get);

router.get('/students', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/students', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/students/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/students/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(studentId: number) {
	return `/students/${studentId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
