import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../../PrismaClient.js'
import { AuthRegistry } from '../../auth.js';
import { ValidationError } from '../../Validation.js';
import { defaultGetHandler, defaultListHandler } from '../../defaultEndpoint.js';
import { PaginationQueryType } from '../../pagination.js';
extendZodWithOpenApi(z);
import courseEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler } from '../../BuildHandler.js';
import registry from './OpenAPI.js';


const list = defaultListHandler(
	prisma.course,
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
	prisma.course,
	courseEntity.selection,
	courseEntity.build,
	"Course not found"
)


async function createFn({ body }: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const existing = await prisma.course.findUnique({
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

	const course = await prisma.course.create({
		...courseEntity.selection,
		data: body,
	});

	const entity = courseEntity.build(course);
	return { 201: entity };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	if (body.code !== undefined) {
		const existing = await prisma.course.findUnique({ where: { code: body.code } });
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

	const course = await prisma.course.update({
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


async function deleteFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.course.findUnique({ where: { id: id } });
	if (!existing) {
		return {
			404: { description: 'Course not found' }
		}
	}
	await prisma.course.delete({ where: { id: id } });
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
