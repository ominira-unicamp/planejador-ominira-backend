import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler } from '../../defaultEndpoint.js';
import instituteEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, Context, HandlerFn } from '../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/institutes');
authRegistry.addException('GET', '/institutes/:id');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const institutes = await ctx.prisma.institute.findMany();
	const entities = institutes.map(instituteEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.institute,
	{},
	instituteEntity.build,
	"Institute not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body } = input;
	const existing = await ctx.prisma.institute.findUnique({ where: { code: body.code } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "code"],
				message: "An institute with this code already exists"
			}])
		};
	}
	const institute = await ctx.prisma.institute.create({
		data: {
			code: body.code,
		},
	});
	return { 201: instituteEntity.build(institute) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	const existing = await ctx.prisma.institute.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Institute not found" } };

	if (body.code !== undefined) {
		const codeExists = await ctx.prisma.institute.findUnique({ where: { code: body.code } });
		if (codeExists && codeExists.id !== id) {
			return {
				400: new ValidationError([{
					code: "ALREADY_EXISTS",
					path: ["body", "code"],
					message: "An institute with this code already exists"
				}])
			};
		}
	}

	const institute = await ctx.prisma.institute.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
		},
	});
	return { 200: instituteEntity.build(institute) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	const existing = await ctx.prisma.institute.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Institute not found" } };
	await ctx.prisma.institute.delete({ where: { id } });
	return { 204: null };
}

router.get('/institutes/:id', get);

router.get('/institutes', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/institutes', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/institutes/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/institutes/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(instituteId: number) {
	return `/institutes/${instituteId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
