import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { defaultGetHandler } from '../../defaultEndpoint.js';
import catalogEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, HandlerFn } from '../../BuildHandler.js'
import registry from './OpenAPI.js';
import { ValidationError } from '../../Validation.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/catalogs/:id');
authRegistry.addException('GET', '/catalogs');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const { query } = input;
	const catalogs = await ctx.prisma.catalog.findMany({
		...catalogEntity.prismaSelection,
		where: {
			...(query?.year && { year: query.year }),
		},
		orderBy: {
			year: 'desc',
		}
	});
	const entities = catalogs.map(catalogEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.catalog,
	catalogEntity.prismaSelection,
	catalogEntity.build,
	"Catalog not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body: { year } } = input;
	
	const existing = await ctx.prisma.catalog.findFirst({
		where: { year }
	});
	
	if (existing) {
		const error = new ValidationError();
		error.addError({
			path: ['body', 'year'],
			code: 'ALREADY_EXISTS',
			message: `Catalog for year ${year} already exists`,
		});
		return { 400: error };
	}

	const catalog = await ctx.prisma.catalog.create({
		...catalogEntity.prismaSelection,
		data: {
			year,
		},
	});
	return { 201: catalogEntity.build(catalog) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body: { year } } = input;
	
	const existing = await ctx.prisma.catalog.findUnique({
		where: { id }
	});
	
	if (!existing) {
		return { 404: { description: "Catalog not found" } };
	}
	
	const duplicate = await ctx.prisma.catalog.findFirst({
		where: { 
			year,
			id: { not: id }
		}
	});
	
	if (duplicate) {
		const error = new ValidationError();
		error.addError({
			path: ['body', 'year'],
			code: 'ALREADY_EXISTS',
			message: `Catalog for year ${year} already exists`,
		});
		return { 400: error };
	}

	const catalog = await ctx.prisma.catalog.update({
		...catalogEntity.prismaSelection,
		where: { id },
		data: { year }
	});
	
	return { 200: catalogEntity.build(catalog) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	
	const existing = await ctx.prisma.catalog.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					students: true,
					programs: true,
				}
			}
		}
	});
	
	if (!existing) {
		return { 404: { description: "Catalog not found" } };
	}
	
	if (existing._count.students > 0 || existing._count.programs > 0) {
		const error = new ValidationError();
		error.addError({
			path: ['path', 'id'],
			code: 'REFERENCE_EXISTS',
			message: `Cannot delete catalog with ${existing._count.students} students and ${existing._count.programs} programs`,
		});
		return { 400: error };
	}
	
	await ctx.prisma.catalog.delete({ where: { id } });
	return { 204: null };
}

router.get('/catalogs/:id', get);

router.get('/catalogs', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/catalogs', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/catalogs/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/catalogs/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(catalogId: number) {
	return `/catalogs/${catalogId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
