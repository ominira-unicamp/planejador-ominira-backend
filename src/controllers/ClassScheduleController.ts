import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { selectIdCode, whereIdName, whereIdCode, MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { requestSafeParse, ValidationError, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
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

function buildClassScheduleEntity(classSchedule: PrismaClassSchedulePayload) : z.infer<typeof ClassScheduleEntity> {
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
	const { success, query, error } = requestSafeParse({
		querySchema: getClassSchedules,
		query: req.query,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}
	prisma.classSchedule.findMany({
		where: {
			dayOfWeek: query.dayOfWeek,
			room: whereIdCode(query.roomId, query.roomCode),
			class: {
				course: {
					...whereIdCode(query.courseId, query.courseCode),
					institute: whereIdName(query.instituteId, query.instituteCode),
					studyPeriod: whereIdName(query.studyPeriodId, query.studyPeriodCode),
				},
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
registry.registerPath({
	method: 'get',
	path: '/class-schedules/{id}',
	tags: ['class-schedule'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(ClassScheduleEntity, "A class schedule by id")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});
async function get(req: Request, res: Response) {
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}
	prisma.classSchedule.findUnique({
		where: {
			id: params.id,
		},
		...prismaClassScheduleFieldSelection,
	}).then((classSchedule) => {
		if (!classSchedule) {
			res.status(404).json({ error: "Class schedule not found" });
			return;
		}
		const entity: z.infer<typeof ClassScheduleEntity> = buildClassScheduleEntity(classSchedule);
		res.json(ClassScheduleEntity.parse(entity))
	})
}
router.get('/class-schedules/:id', get)


const createClassScheduleBody = classScheduleBase.openapi('CreateClassScheduleBody');

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
	const { success, data: body, error } = createClassScheduleBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	
	if (body) {
		const room = await prisma.room.findUnique({ where: { id: body.roomId } });
		if (!room) {
			errors.addError(['body', 'roomId'], 'Room not found');
		}
		
		const classData = await prisma.class.findUnique({ where: { id: body.classId } });
		if (!classData) {
			errors.addError(['body', 'classId'], 'Class not found');
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const classSchedule = await prisma.classSchedule.create({
		data: body,
		...prismaClassScheduleFieldSelection,
	});

	const entity = buildClassScheduleEntity(classSchedule)

	res.status(201).json(ClassScheduleEntity.parse(entity));
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
	const { success, params, body, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
		bodySchema: patchClassScheduleBody,
		body: req.body,
	});
	const validation = new ValidationError('Validation errors', error);

	if (success && body?.roomId !== undefined) {
		const room = await prisma.room.findUnique({ where: { id: body.roomId } });
		if (!room) {
			validation.addError(['body', 'roomId'], 'Room not found');
		}
	}

	if (success && body?.classId !== undefined) {
		const classData = await prisma.class.findUnique({ where: { id: body.classId } });
		if (!classData) {
			validation.addError(['body', 'classId'], 'Class not found');
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}

	const existing = await prisma.classSchedule.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Class schedule not found' });
		return;
	}

	const classSchedule = await prisma.classSchedule.update({
		where: { id: params.id },
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
	res.json(ClassScheduleEntity.parse(entity));
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
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.classSchedule.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Class schedule not found' });
		return;
	}

	await prisma.classSchedule.delete({ where: { id: params.id } });
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
