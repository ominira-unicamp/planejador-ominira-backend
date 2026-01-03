import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { whereIdCode } from '../../PrismaClient.js'
import { AuthRegistry } from '../../auth.js';
import { ValidationError, ZodToApiError } from '../../Validation.js';
import { defaultGetHandler, defaultListHandler } from '../../defaultEndpoint.js';
import classScheduleEntity from './Entity.js';
import IO, { ListQueryParams } from './Interface.js';
import { buildHandler } from '../../BuildHandler.js';
import registry from './OpenAPI.js';
import { zodIds } from '../../PrismaValidator.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/class-schedules');
authRegistry.addException('GET', '/class-schedules/:id');

const list = defaultListHandler(
	prisma.classSchedule,
	IO.list.input.shape.query,
	(query) => ({
		dayOfWeek: query.dayOfWeek,
		room: whereIdCode(query.roomId, query.roomCode),
		class: {
			...whereIdCode(query.classId, undefined),
			course: {
				...whereIdCode(query.courseId, query.courseCode),
				institute: whereIdCode(query.instituteId, query.instituteCode),
			},
			studyPeriod: whereIdCode(query.studyPeriodId, query.studyPeriodCode),
		},
	}),
	listPath,
	classScheduleEntity.prismaSelection,
	classScheduleEntity.build,
);

router.get('/class-schedules', list);

const get = defaultGetHandler(
	prisma.classSchedule,
	classScheduleEntity.prismaSelection,
	classScheduleEntity.build,
	"Class schedule not found"
);

router.get('/class-schedules/:id', get);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { body } = input;
	
	// Validate foreign keys
	const validationSchema = z.object({
		roomId: zodIds.room.exists,
		classId: zodIds.class.exists
	});
	
	const validation = await validationSchema.safeParseAsync(body);
	if (!validation.success) {
		return {
			400: new ValidationError(ZodToApiError(validation.error, ['body']))
		};
	}
	
	const classSchedule = await prisma.classSchedule.create({
		data: body,
		...classScheduleEntity.prismaSelection,
	});
	return { 201: classScheduleEntity.build(classSchedule) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	
	const existing = await prisma.classSchedule.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Class schedule not found" } };

	// Validate foreign keys if provided
	const validationSchema = z.object({
		roomId: zodIds.room.exists.optional(),
		classId: zodIds.class.exists.optional()
	});
	
	const validation = await validationSchema.safeParseAsync(body);
	if (!validation.success) {
		return {
			400: new ValidationError(ZodToApiError(validation.error, ['body']))
		};
	}

	const classSchedule = await prisma.classSchedule.update({
		where: { id },
		data: {
			...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
			...(body.start !== undefined && { start: body.start }),
			...(body.end !== undefined && { end: body.end }),
			...(body.roomId !== undefined && { roomId: body.roomId }),
			...(body.classId !== undefined && { classId: body.classId }),
		},
		...classScheduleEntity.prismaSelection,
	});
	return { 200: classScheduleEntity.build(classSchedule) };
}

async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.classSchedule.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Class schedule not found" } };
	await prisma.classSchedule.delete({ where: { id } });
	return { 204: null };
}

router.post('/class-schedules', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/class-schedules/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/class-schedules/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function listPath({ instituteId, courseId, studyPeriodId, classId, page, pageSize }: ListQueryParams) {
	return `/class-schedules?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		studyPeriodId ? "studyPeriodId=" + studyPeriodId : undefined,
		classId ? "classId=" + classId : undefined,
		page ? "page=" + page : undefined,
		pageSize ? "pageSize=" + pageSize : undefined,
	].filter(Boolean).join('&');
}

function entityPath(id: number) {
	return `/class-schedules/${id}`;
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
