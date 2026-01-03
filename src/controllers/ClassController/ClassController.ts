import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { whereIdCode, whereIdName } from '../../PrismaClient.js'
import { AuthRegistry } from '../../auth.js';
import { ValidationError, ZodToApiError } from '../../Validation.js';
import { defaultGetHandler, defaultListHandler } from '../../defaultEndpoint.js';
import classEntity from './Entity.js';
import IO, { ListQueryParams } from './Interface.js';
import { buildHandler } from '../../BuildHandler.js';
import registry from './OpenAPI.js';
import { zodIds } from '../../PrismaValidator.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/classes');
authRegistry.addException('GET', '/classes/:id');

const list = defaultListHandler(
	prisma.class,
	IO.list.input.shape.query,
	(query) => ({
		course: {
			...whereIdCode(query.courseId, query.courseCode),
			institute: whereIdCode(query.instituteId, query.instituteCode),
		},
		studyPeriod: whereIdCode(query.studyPeriodId, query.studyPeriodCode),
		professors: {
			some: whereIdName(query.professorId, query.professorName)
		},
	}),
	listPath,
	classEntity.prismaSelection,
	classEntity.build,
);

router.get('/classes', list);

const get = defaultGetHandler(
	prisma.class,
	classEntity.prismaSelection,
	classEntity.build,
	"Class not found"
);

router.get('/classes/:id', get);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { body } = input;
	
	// Validate foreign keys
	const validationSchema = z.object({
		courseId: zodIds.course.exists,
		studyPeriodId: zodIds.studyPeriod.exists,
		professorIds: zodIds.professor.existsMany,
	});
	
	const validation = await validationSchema.safeParseAsync(body);
	if (!validation.success) {
		return {
			400: new ValidationError(ZodToApiError(validation.error, ['body']))
		};
	}
	
	const classData = await prisma.class.create({
		data: {
			code: body.code,
			courseId: body.courseId,
			studyPeriodId: body.studyPeriodId,
			reservations: body.reservations,
			professors: {
				connect: body.professorIds.map(id => ({ id })),
			},
		},
		...classEntity.prismaSelection,
	});
	return { 201: classEntity.build(classData) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	
	const existing = await prisma.class.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Class not found" } };

	// Validate foreign keys if provided
	const validationSchema = z.object({
		courseId: zodIds.course.exists.optional(),
		studyPeriodId: zodIds.studyPeriod.exists.optional(),
		professorIds: zodIds.professor.existsMany.optional(),
	});
	
	const validation = await validationSchema.safeParseAsync(body);
	if (!validation.success) {
		return {
			400: new ValidationError(ZodToApiError(validation.error, ['body']))
		};
	}

	const classData = await prisma.class.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.courseId !== undefined && { courseId: body.courseId }),
			...(body.studyPeriodId !== undefined && { studyPeriodId: body.studyPeriodId }),
			...(body.reservations !== undefined && { reservations: body.reservations }),
			...(body.professorIds !== undefined && {
				professors: {
					set: body.professorIds.map(id => ({ id })),
				},
			}),
		},
		...classEntity.prismaSelection,
	});
	return { 200: classEntity.build(classData) };
}

async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.class.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Class not found" } };
	await prisma.class.delete({ where: { id } });
	return { 204: null };
}

router.post('/classes', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/classes/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/classes/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function listPath(query: ListQueryParams) {
	return `/classes?` + [
		query.instituteId ? "instituteId=" + query.instituteId : undefined,
		query.courseId ? "courseId=" + query.courseId : undefined,
		query.studyPeriodId ? "studyPeriodId=" + query.studyPeriodId : undefined,
		query.professorId ? "professorId=" + query.professorId : undefined,
		query.page ? "page=" + query.page : undefined,
		query.pageSize ? "pageSize=" + query.pageSize : undefined,
	].filter(Boolean).join('&');
}

function entityPath(id: number) {
	return `/classes/${id}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
}
