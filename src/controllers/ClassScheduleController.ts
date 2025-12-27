import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { selectIdCode, whereIdName, whereIdCode } from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { ZodErrorResponse } from '../Validation';
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const daysOfWeekEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).openapi('DaysOfWeekEnum');

const prismaClassScheduleFieldSelection = {
	include: {
		room: selectIdCode,
		class: {
			select: {
				id: true,
				name: true,
				courseOfferingId: true,
				coursesOffering: {
					select: {
						institute: selectIdCode,
						course: selectIdCode,
						studyPeriod: selectIdCode
					}
				}
			}
		},
	},
}
const ClassScheduleEntity = z.object({
	id: z.number().int(),
	dayOfWeek: daysOfWeekEnum,
	start: z.string(),
	end: z.string(),
	roomId: z.number().int(),
	roomCode: z.string(),
	classId: z.number().int(),
	className: z.string(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	courseId: z.number().int(),
	courseCode: z.string(),
	courseOfferingId: z.number().int(),
	periodId: z.number().int(),
	periodName: z.string(),
	_paths: z.object({
		entity: z.string(),
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		courseOffering: z.string(),
		class: z.string(),
	}).strict(),
}).strict().openapi('ClassScheduleEntity');

function relatedPathsForClassSchedule(
	classScheduleId: number,
	studyPeriodId: number,
	instituteId: number,
	courseId: number,
	courseOfferingId: number,
	classId: number,
) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
		institute: resourcesPaths.institute.entity(instituteId),
		course: resourcesPaths.course.entity(courseId),
		courseOffering: resourcesPaths.courseOffering.entity(courseOfferingId),
		class: resourcesPaths.class.entity(classId),
		entity: entityPath(classScheduleId)
	}
}
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
		res.status(400).json(ZodErrorResponse(["query"], error));
		return;
	}
	prisma.classSchedule.findMany({
		where: {
			dayOfWeek: query.dayOfWeek,
			room: whereIdCode(query.roomId, query.roomCode),
			class: {
				coursesOffering: {
					institute: whereIdName(query.instituteId, query.instituteCode),
					course: whereIdCode(query.courseId, query.courseCode),
					studyPeriod: whereIdName(query.studyPeriodId, query.studyPeriodCode),
				},
			},
		},
		...prismaClassScheduleFieldSelection,
	}).then((classSchedules) => {
		const entities: z.infer<typeof ClassScheduleEntity>[] = classSchedules.map((classSchedule) => {
			const { room, class: classObj, ...rest } = classSchedule
			return {
				...rest,
				roomCode: room.code,
				className: classObj.name,
				classId: classObj.id,
				instituteId: classObj.coursesOffering.institute.id,
				instituteCode: classObj.coursesOffering.institute.code,
				courseId: classObj.coursesOffering.course.id,
				courseCode: classObj.coursesOffering.course.code,
				courseOfferingId: classObj.courseOfferingId,
				periodId: classObj.coursesOffering.studyPeriod.id,
				periodName: classObj.coursesOffering.studyPeriod.code,
				_paths: relatedPathsForClassSchedule(
					classSchedule.id,
					classObj.coursesOffering.studyPeriod.id,
					classObj.coursesOffering.institute.id,
					classObj.coursesOffering.course.id,
					classObj.courseOfferingId,
					classObj.id
				)
			}
		})
		res.json(z.array(ClassScheduleEntity).parse(entities));
	})
}
router.get('/class-schedules', list)
interface ListQueryParams {
	instituteId?: number,
	courseId?: number,
	periodId?: number,
	classId?: number,
}

function listPath({ instituteId, courseId, periodId, classId }: ListQueryParams) {
	return `/class-schedules?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		periodId ? "periodId=" + periodId : undefined,
		classId ? "classId=" + classId : undefined,
	].filter(Boolean).join('&');
}

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
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["params", "id"], error));
		return;
	}
	prisma.classSchedule.findUnique({
		where: {
			id: id,
		},
		...prismaClassScheduleFieldSelection,
	}).then((classSchedule) => {
		if (!classSchedule) {
			res.status(404).json({ error: "Class schedule not found" });
			return;
		}
		const { room, class: classObj, ...rest } = classSchedule
		const entity: z.infer<typeof ClassScheduleEntity> = ClassScheduleEntity.parse({
			...rest,
			roomCode: room.code,
			className: classObj.name,
			classId: classObj.id,
			instituteId: classObj.coursesOffering.institute.id,
			instituteCode: classObj.coursesOffering.institute.code,
			courseId: classObj.coursesOffering.course.id,
			courseCode: classObj.coursesOffering.course.code,
			courseOfferingId: classObj.courseOfferingId,
			periodId: classObj.coursesOffering.studyPeriod.id,
			periodName: classObj.coursesOffering.studyPeriod.code,
			_paths: relatedPathsForClassSchedule(
				classSchedule.id,
				classObj.coursesOffering.studyPeriod.id,
				classObj.coursesOffering.institute.id,
				classObj.coursesOffering.course.id,
				classObj.courseOfferingId,
				classObj.id
			),
		})
		res.json(entity)
	})
}
router.get('/class-schedules/:id', get)


function entityPath(id: number) {
	return `/class-schedules/${id}`;
}

export default {
	router,
	registry,
	paths: {
		list: listPath,
		entity: entityPath,
	},
}
