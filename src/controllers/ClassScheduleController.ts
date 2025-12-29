import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { selectIdCode, whereIdName, whereIdCode, MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { ValidationError, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { zodIds } from '../PrismaValidator';
import { defaultGetHandler, defaultOpenApiGetPath } from '../defaultEndpoint';
extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

const daysOfWeekEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).openapi('DaysOfWeekEnum');

const prismaClassScheduleFieldSelection = {
	include: {
		room: selectIdCode,
		class: {
			select: {
				id: true,
				code: true,
				courseId: true,
				studyPeriodId: true,
				studyPeriod: selectIdCode,
				course: {
					select: {
						id: true,
						code: true,
						institute: selectIdCode,
					}
				}
			}
		},
	},
} as const satisfies MyPrisma.ClassScheduleDefaultArgs;
type PrismaClassSchedulePayload = MyPrisma.ClassScheduleGetPayload<typeof prismaClassScheduleFieldSelection>;

function relatedPathsForClassSchedule(
	classScheduleId: number,
	studyPeriodId: number,
	instituteId: number,
	courseId: number,
	classId: number,
) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
		institute: resourcesPaths.institute.entity(instituteId),
		course: resourcesPaths.course.entity(courseId),
		class: resourcesPaths.class.entity(classId),
		entity: entityPath(classScheduleId)
	}
}

function buildClassScheduleEntity(classSchedule: PrismaClassSchedulePayload): z.infer<typeof ClassScheduleEntity> {
	const { room, class: classObj, ...rest } = classSchedule
	return {
		...rest,
		roomCode: room.code,
		classCode: classObj.code,
		classId: classObj.id,
		instituteId: classObj.course.institute.id,
		instituteCode: classObj.course.institute.code,
		courseId: classObj.course.id,
		courseCode: classObj.course.code,
		studyPeriodId: classObj.studyPeriod.id,
		studyPeriodCode: classObj.studyPeriod.code,
		_paths: relatedPathsForClassSchedule(
			classSchedule.id,
			classObj.studyPeriod.id,
			classObj.course.institute.id,
			classObj.course.id,
			classObj.id
		)
	}
}
const classScheduleBase = z.object({
	id: z.number().int(),
	dayOfWeek: daysOfWeekEnum,
	start: z.string().min(1),
	end: z.string().min(1),
	roomId: z.number().int(),
	classId: z.number().int(),
});

const ClassScheduleEntity = classScheduleBase.extend({
	roomCode: z.string(),
	classCode: z.string(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	courseId: z.number().int(),
	courseCode: z.string(),
	studyPeriodId: z.number().int(),
	studyPeriodCode: z.string(),
	_paths: z.object({
		entity: z.string(),
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		class: z.string(),
	}).strict(),
}).strict().openapi('ClassScheduleEntity');

const getClassSchedules = z.object({
	studyPeriodId: z.coerce.number().int().optional(),
	studyPeriodCode: z.string().optional(),
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	roomId: z.coerce.number().int().optional(),
	roomCode: z.string().optional(),
	classId: z.coerce.number().int().optional(),
	dayOfWeek: daysOfWeekEnum.optional(),
}).openapi('GetClassSchedulesQuery');

authRegistry.addException('GET', '/class-schedules');
registry.registerPath({
	method: 'get',
	path: '/class-schedules',
	tags: ['class-schedule'],
	request: {
		query: getClassSchedules,
	},
	responses: new ResponseBuilder()
		.ok(z.array(ClassScheduleEntity), "A list of class schedules")
		.badRequest()
		.internalServerError()
		.build(),
});
async function list(req: Request, res: Response) {
	
	const { success, data: query, error } = getClassSchedules.safeParse(req.query);
	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, ['query'])));
		return;
	}
	prisma.classSchedule.findMany({
		where: {
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
		},
		...prismaClassScheduleFieldSelection,
	}).then((classSchedules) => {
		const entities: z.infer<typeof ClassScheduleEntity>[] = classSchedules.map((classSchedule) => buildClassScheduleEntity(classSchedule));
		res.json(z.array(ClassScheduleEntity).parse(entities));
	})
}
router.get('/class-schedules', list)
interface ListQueryParams {
	instituteId?: number,
	courseId?: number,
	studyPeriodId?: number,
	classId?: number,
}

function listPath({ instituteId, courseId, studyPeriodId, classId }: ListQueryParams) {
	return `/class-schedules?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		studyPeriodId ? "studyPeriodId=" + studyPeriodId : undefined,
		classId ? "classId=" + classId : undefined,
	].filter(Boolean).join('&');
}

authRegistry.addException('GET', '/class-schedules/:id');
registry.registerPath(defaultOpenApiGetPath('/class-schedules/{id}', 'class-schedule', ClassScheduleEntity, "A class schedule by id"));
router.get('/class-schedules/:id', defaultGetHandler(
	prisma.classSchedule,
	prismaClassScheduleFieldSelection,
	buildClassScheduleEntity,
	"Class schedule not found"
))


const createClassScheduleBody = classScheduleBase.omit({ id: true }).openapi('CreateClassScheduleBody');

registry.registerPath({
	method: 'post',
	path: '/class-schedules',
	tags: ['class-schedule'],
	request: new RequestBuilder()
		.body(createClassScheduleBody, "Class schedule to create")
		.build(),
	responses: new ResponseBuilder()
		.created(ClassScheduleEntity, "Class schedule created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = await createClassScheduleBody.and(z.object({
		roomId: zodIds.room.exists,
		classId: zodIds.class.exists
	})).safeParseAsync(req.body);
	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, ['body'])));
		return;
	}
	const classSchedule = await prisma.classSchedule.create({
		data: body,
		...prismaClassScheduleFieldSelection,
	});
	const entity = buildClassScheduleEntity(classSchedule)
	res.status(201).json(entity);
}
router.post('/class-schedules', create)

const patchClassScheduleBody = classScheduleBase.partial().openapi('PatchClassScheduleBody');

registry.registerPath({
	method: 'patch',
	path: '/class-schedules/{id}',
	tags: ['class-schedule'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchClassScheduleBody, "Class schedule fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(ClassScheduleEntity, "Class schedule updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, data, error } = await z.object({
		params: z.object({ id: z.coerce.number().int() }).strict(),
		body: patchClassScheduleBody.and(z.object({
			roomId: zodIds.room.exists.optional(),
			classId: zodIds.class.exists.optional()
		}))
	}).safeParseAsync(req);
	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, [])));
		return;
	}
	const { params: { id }, body } = data;

	// Check if class schedule exists
	const existing = await prisma.classSchedule.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: 'Class schedule not found' });
		return;
	}

	const classSchedule = await prisma.classSchedule.update({
		where: { id: id },
		data: {
			...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
			...(body.start !== undefined && { start: body.start }),
			...(body.end !== undefined && { end: body.end }),
			...(body.roomId !== undefined && { roomId: body.roomId }),
			...(body.classId !== undefined && { classId: body.classId }),
		},
		...prismaClassScheduleFieldSelection,
	});

	const entity = buildClassScheduleEntity(classSchedule)
	res.json(entity);
}
router.patch('/class-schedules/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/class-schedules/{id}',
	tags: ['class-schedule'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.build(),
	responses: new ResponseBuilder()
		.noContent()
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function deleteClassSchedule(req: Request, res: Response) {
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, ['params', 'id'])));
		return;
	}
	const existing = await prisma.classSchedule.findUnique({ where: { id: id } });
	if (!existing) {
		res.status(404).json({ error: 'Class schedule not found' });
		return;
	}
	await prisma.classSchedule.delete({ where: { id: id } });
	res.status(204).send();
}
router.delete('/class-schedules/:id', deleteClassSchedule)

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
