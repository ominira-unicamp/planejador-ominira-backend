import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler, defaultListHandler } from '../../defaultEndpoint.js';
import professorEntity from './Entity.js';
import IO, { ListQueryParams } from './Interface.js';import { buildHandler, Context, HandlerFn } from '../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/professors');
authRegistry.addException('GET', '/professors/:id');

const list = defaultListHandler(
	(p) => p.professor,
	IO.list.input.shape.query,
	(query) => (query.classId ? { classes: { some: { id: query.classId } } } : {}),
	listPath,
	{},
	professorEntity.build,
);

router.get('/professors', list);

const get = defaultGetHandler(
	(p) => p.professor,
	{},
	professorEntity.build,
	"Professor not found"
);

router.get('/professors/:id', get);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body } = input;
	const professor = await ctx.prisma.professor.create({
		data: {
			name: body.name,
		},
	});
	return { 201: professorEntity.build(professor) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	const existing = await ctx.prisma.professor.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Professor not found" } };

	const professor = await ctx.prisma.professor.update({
		where: { id },
		data: {
			...(body.name !== undefined && { name: body.name }),
		},
	});
	return { 200: professorEntity.build(professor) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	const existing = await ctx.prisma.professor.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Professor not found" } };
	await ctx.prisma.professor.delete({ where: { id } });
	return { 204: null };
}

router.post('/professors', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/professors/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/professors/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function listPath({
	classId,
	page,
	pageSize
}: ListQueryParams) {
	return `/professors?` + [
		classId ? "classId=" + classId : undefined,
		page ? "page=" + page : undefined,
		pageSize ? "pageSize=" + pageSize : undefined,
	].filter(Boolean).join('&');
}

function entityPath(professorId: number) {
	return `/professors/${professorId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	},
}
