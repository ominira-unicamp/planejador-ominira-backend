import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler, defaultListHandler } from '../../defaultEndpoint.js';
import { PaginationQueryType } from '../../pagination.js';
extendZodWithOpenApi(z);
import courseEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, Context, HandlerFn } from '../../BuildHandler.js';
import registry from './OpenAPI.js';


const list = defaultListHandler(
	(p) => p.course,
	IO.list.input.shape.query,
	(query) => ({
		institute: {
			...(query.instituteId ? { id: query.instituteId } : {}),
			...(query.instituteCode ? { code: query.instituteCode } : {}),
		}
	}),
	listPath,
	courseEntity.selection,
	courseEntity.build,
);


const get = defaultGetHandler(
	(p) => p.course,
	courseEntity.selection,
	courseEntity.build,
	"Course not found"
)


const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { body } = input;
	const existing = await ctx.prisma.course.findUnique({
		where: { code: body.code }
	});
	if (!existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ['body', 'code'],
				message: 'A course with this code already exists'
			}])
		};
	}

	const course = await ctx.prisma.course.create({
		...courseEntity.selection,
		data: body,
	});

	const entity = courseEntity.build(course);
	return { 201: entity };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { id }, body } = input;
	if (body.code !== undefined) {
		const existing = await ctx.prisma.course.findUnique({ where: { code: body.code } });
		if (existing && existing.id !== id) {
			return {
				400: new ValidationError([{
					code: "ALREADY_EXISTS",
					path: ['body', 'code'],
					message: 'A course with this code already exists'
				}])
			};
		}
	}

	const course = await ctx.prisma.course.update({
		...courseEntity.selection,
		where: { id: id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.name !== undefined && { name: body.name }),
			...(body.credits !== undefined && { credits: body.credits }),
		},
	});

	const entity = courseEntity.build(course);
	return { 200: entity };
}


const deleteFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { id } } = input;
	const existing = await ctx.prisma.course.findUnique({ where: { id: id } });
	if (!existing) {
		return {
			404: { description: 'Course not found' }
		}
	}
	await ctx.prisma.course.delete({ where: { id: id } });
	return { 200: undefined };
}

const router = Router()
const authRegistry = new AuthRegistry();

router.get('/courses/:id', get)

authRegistry.addException('GET', '/courses');
router.get('/courses', list)

router.post('/courses', buildHandler(IO.create.input, IO.create.output, createFn))

router.patch('/courses/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn))

router.delete('/courses/:id', buildHandler(IO.remove.input, IO.remove.output, deleteFn))


function entityPath(courseId: number) {
	return `/courses/${courseId}`;
}

type ListQueryParams = {
	instituteId?: number,
} & Partial<PaginationQueryType>;

function listPath(query: ListQueryParams) {
	return `/courses?` + [
		query.instituteId ? "instituteId=" + query.instituteId : undefined,
		query.page ? "page=" + query.page : undefined,
		query.pageSize ? "pageSize=" + query.pageSize : undefined,
	].filter(Boolean).join('&');
}

authRegistry.addException('GET', '/courses/:id');

export default {
	router,
	registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	},
	entity: courseEntity
}
