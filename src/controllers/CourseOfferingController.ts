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

const prismaCourseOfferingFieldSelection = {
	include: {
		institute: selectIdCode,
		studyPeriod: selectIdCode,
		course: selectIdCode
	}
}
const relatedPathsForClassOffering = (
	courseOfferingId: number,
	courseId: number,
	instituteId: number,
	studyPeriodId: number,
) => {
	return {
		entity: entityPath(courseOfferingId),
		institute: resourcesPaths.institute.entity(instituteId),
		studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
		course: resourcesPaths.course.entity(courseId),
	}
}

const CourseOfferingEntity = z.object({
	id: z.number().int(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	courseId: z.number().int(),
	courseCode: z.string(),
	studyPeriodId: z.number().int(),
	studyPeriodCode: z.string(),
	_paths: z.object({
		entity: z.string(),
		institute: z.string(),
		studyPeriod: z.string(),
		course: z.string(),
	})
}).strict().openapi('CourseOfferingEntity');

const getCourseOffering = z.object({
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	periodId: z.coerce.number().int().optional(),
	periodName: z.string().optional(),
}).openapi('GetCourseOfferingQuery');

registry.registerPath({
	method: 'get',
	path: '/course-offerings',
	tags: ['course-offering'],
	request: {
		query: getCourseOffering,
	},
	responses: new ResponseBuilder()
		.ok(z.array(CourseOfferingEntity), "A list of course offerings")
		.badRequest()
		.internalServerError()
		.build(),
});
async function list(req: Request, res: Response) {
	const { success, data: query, error } = getCourseOffering.safeParse(req.query);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["query"], error));
		return;
	}
	prisma.courseOffering.findMany({
		where: {
			institute: whereIdName(query.instituteId, query.instituteCode),
			course: whereIdCode(query.courseId, query.courseCode),
			studyPeriod: whereIdName(query.periodId, query.periodName),
		},
		...prismaCourseOfferingFieldSelection
	}).then((courseOfferings) => {
		const entities: z.infer<typeof CourseOfferingEntity>[] = courseOfferings.map(co => {
			const {institute, course, studyPeriod, ...rest} = co;
			return {
				...rest,
				instituteCode: institute.code,
				courseCode: course.code,
				studyPeriodCode: studyPeriod.code,
				_paths: relatedPathsForClassOffering(
					co.id,
					co.courseId,
					co.instituteId,
					co.studyPeriodId
				)
			}
		})
		res.json(entities)
	})
}
router.get('/course-offerings', list)
interface ListQueryParams {
	instituteId?: number,
	courseId?: number,
	periodId?: number
}

function listPath({
	instituteId,
	courseId,
	periodId
}: ListQueryParams) {
	return `/course-offerings?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		periodId ? "periodId=" + periodId : undefined,
	].filter(Boolean).join('&');
}



registry.registerPath({
	method: 'get',
	path: '/course-offerings/{id}',
	tags: ['course-offering'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(CourseOfferingEntity, "A course offering by id")
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
	prisma.courseOffering.findUnique({
		where: {
			id: id,
		},
		...prismaCourseOfferingFieldSelection
	}).then((courseOffering) => {
		if (!courseOffering) {
			res.status(404).json({ error: "Course offering not found" });
			return;
		}

		const {institute, course, studyPeriod, ...rest} = courseOffering;
		
		const entity: z.infer<typeof CourseOfferingEntity> = {
			...rest,
			instituteCode: institute.code,
			courseCode: course.code,
			studyPeriodCode: studyPeriod.code,
			_paths: relatedPathsForClassOffering(
				courseOffering.id,
				courseOffering.courseId,
				courseOffering.instituteId,
				courseOffering.studyPeriodId
			)
		};
		res.json(entity)
	})
}
router.get('/course-offerings/:id', get)

function entityPath(courseOfferingId: number) {
	return `/course-offerings/${courseOfferingId}`;
}

export default {
	router,
	registry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
}
