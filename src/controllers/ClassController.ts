import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { selectIdCode, selectIdName, whereIdCode, whereIdName } from '../PrismaClient'
import { models } from '../PrismaClient';
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../ResponseBuilder';
import { ZodErrorResponse } from '../Validation';
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const prismaClassFieldSelection = {
	include: {
		professors: selectIdName,
		coursesOffering: {
			select: {
				studyPeriod: selectIdName,
				course: selectIdCode,
				institute: selectIdName,
			}
		}
	}
}


function relatedPathsForClass(
	classId: number,
	studyPeriodId: number,
	instituteId: number,
	courseId: number,
	courseOfferingId: number,
) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
		institute: resourcesPaths.institute.entity(instituteId),
		course: resourcesPaths.course.entity(courseId),
		courseOffering: resourcesPaths.courseOffering.entity(courseOfferingId),
		class: resourcesPaths.class.entity(classId),
		classSchedules: resourcesPaths.classSchedule.list({
			classId: classId,
		}),
		professors: resourcesPaths.professor.list({
			classId: classId,
		}),
	}
}

const classEntity = z.object({
	id: z.number().int(),
	name: z.string(),
	reservations: z.array(z.number().int()),
	courseOfferingId: z.number().int(),
	studyPeriodId: z.number().int(),
	studyPeriodName: z.string(),
	courseId: z.number().int(),
	courseCode: z.string(),
	instituteId: z.number().int(),
	instituteName: z.string(),
	professors: z.array(z.object({
		id: z.number().int(),
		name: z.string(),
	}).strict()),
	_paths: z.object({
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		courseOffering: z.string(),
		class: z.string(),
		classSchedules: z.string(),
		professors: z.string(),
	}).strict(),
}).strict().openapi('ClassEntity');



const listClassesQuery = z.object({
	instituteId: z.coerce.number().int().optional(),
	instituteName: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	periodId: z.coerce.number().int().optional(),
	periodName: z.string().optional(),
	professorId: z.coerce.number().int().optional(),
	professorName: z.string().optional(),
}).openapi('GetClassesQuery');

const internalServerError =
	registry.registerPath({
		method: 'get',
		path: '/classes',
		tags: ['class'],
		request: {
			query: listClassesQuery,
		},
		responses: new ResponseBuilder()
			.ok(z.array(classEntity), "A list of classes")
			.badRequest()
			.internalServerError()
			.build(),

	});

async function listAll(req: Request, res: Response) {
	const { success, data: query, error } = listClassesQuery.safeParse(req.query);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["query"], error));
		return
	}
	const classes = await prisma.class.findMany({
		where: {
			coursesOffering: {
				instituteId: query.instituteId,
				institute: whereIdName(query.instituteId, query.instituteName),
				course: whereIdCode(query.courseId, query.courseCode),
				studyPeriod: whereIdName(query.periodId, query.periodName)
			},
			professors: {
				some: whereIdName(query.professorId, query.professorName)
			},
		},
		...prismaClassFieldSelection,
	});


	const entities: z.infer<typeof classEntity>[] = classes.map(c => {
		const { coursesOffering, ...rest } = c;
		return {
			...rest,
			studyPeriodId: coursesOffering.studyPeriod.id,
			studyPeriodName: coursesOffering.studyPeriod.name,
			courseId: coursesOffering.course.id,
			courseCode: coursesOffering.course.code,
			instituteId: coursesOffering.institute.id,
			instituteName: coursesOffering.institute.name,
			_paths: relatedPathsForClass(
				c.id,
				coursesOffering.studyPeriod.id,
				coursesOffering.institute.id,
				coursesOffering.course.id,
				rest.courseOfferingId
			),
		};
	});
	res.json(z.array(classEntity).parse(entities));
}
router.get('/classes', listAll)




type ListQueryParams = {
	instituteId?: number | undefined,
	courseId?: number | undefined,
	periodId?: number | undefined,
	professorId?: number | undefined
}


function listPath({
	instituteId,
	courseId,
	periodId,
	professorId
}: ListQueryParams) {
	return `/classes?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		periodId ? "periodId=" + periodId : undefined,
		professorId ? "professorId=" + professorId : undefined,
	].filter(Boolean).join('&');
}


registry.registerPath({
	method: 'get',
	path: '/classes/{id}',
	tags: ['class'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(classEntity, "A class")
		.internalServerError()
		.build(),
});
async function get(req: Request, res: Response) {
	const id = z.coerce.number().int().parse(req.params.id);
	prisma.class.findUnique({
		where: {
			id: id,
		},
		...prismaClassFieldSelection
	}).then((classData) => {
		if (!classData) {
			res.status(404).json({ error: "Class not found" });
			return;
		}
		const { coursesOffering, ...rest } = classData;
		const entity: z.infer<typeof classEntity> = {
			...rest,
			studyPeriodId: coursesOffering.studyPeriod.id,
			studyPeriodName: coursesOffering.studyPeriod.name,
			courseId: coursesOffering.course.id,
			courseCode: coursesOffering.course.code,
			instituteId: coursesOffering.institute.id,
			instituteName: coursesOffering.institute.name,
			_paths: relatedPathsForClass(
				rest.id,
				coursesOffering.studyPeriod.id,
				coursesOffering.institute.id,
				coursesOffering.course.id,
				rest.courseOfferingId
			),
		}
		res.json(classEntity.parse(entity))
	})
}
router.get('/classes/:id', get)

function entityPath(id: number) {
	return `/classes/${id}`;
}

export default {
	router,
	registry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
} 