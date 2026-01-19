import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { defaultGetHandler } from '../../defaultEndpoint.js';
import specializationEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, HandlerFn } from '../../BuildHandler.js'
import registry from './OpenAPI.js';
import { ValidationError } from '../../Validation.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/specializations/:id');
authRegistry.addException('GET', '/specializations');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const specializations = await ctx.prisma.specialization.findMany({
		...specializationEntity.prismaSelection,
		orderBy: {
			name: 'asc',
		}
	});
	const entities = specializations.map(specializationEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.specialization,
	specializationEntity.prismaSelection,
	specializationEntity.build,
	"Specialization not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body: { code, name } } = input;

	const specialization = await ctx.prisma.specialization.create({
		...specializationEntity.prismaSelection,
		data: {
			code,
			name,
		},
	});
	return { 201: specializationEntity.build(specialization) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	
	const existing = await ctx.prisma.specialization.findUnique({
		where: { id }
	});
	
	if (!existing) {
		return { 404: { description: "Specialization not found" } };
	}

	const specialization = await ctx.prisma.specialization.update({
		...specializationEntity.prismaSelection,
		where: { id },
		data: body
	});
	
	return { 200: specializationEntity.build(specialization) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	
	const existing = await ctx.prisma.specialization.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					catalogSpecializations: true,
					students: true,
				}
			}
		}
	});
	
	if (!existing) {
		return { 404: { description: "Specialization not found" } };
	}
	
	if (existing._count.catalogSpecializations > 0 || existing._count.students > 0) {
		const error = new ValidationError();
		error.addError({
			path: ['path', 'id'],
			code: 'REFERENCE_EXISTS',
			message: `Cannot delete specialization with ${existing._count.students} students and ${existing._count.catalogSpecializations} catalog specializations`,
		});
		return { 400: error };
	}
	
	await ctx.prisma.specialization.delete({ where: { id } });
	return { 204: null };
}

router.get('/specializations/:id', get);

router.get('/specializations', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/specializations', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/specializations/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/specializations/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(specializationId: number) {
	return `/specializations/${specializationId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
