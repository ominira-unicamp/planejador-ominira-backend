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

const prismaCourseOfferingFieldSelection = {
	include: {
		institute: selectIdCode,
		studyPeriod: selectIdCode,
		course: selectIdCode
	}
} as const satisfies MyPrisma.CourseOfferingDefaultArgs;
type PrismaCourseOfferingPayload = MyPrisma.CourseOfferingGetPayload<typeof prismaCourseOfferingFieldSelection>;

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

function buildCourseOfferingEntity(co: PrismaCourseOfferingPayload): z.infer<typeof CourseOfferingEntity> {
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
	};
}

const courseOfferingBase = z.object({
	id: z.number().int(),
	instituteId: z.number().int(),
	courseId: z.number().int(),
	studyPeriodId: z.number().int(),
});

const CourseOfferingEntity = courseOfferingBase.extend({
	instituteCode: z.string(),
	courseCode: z.string(),
	studyPeriodCode: z.string(),
	_paths: z.object({
		entity: z.string(),
		institute: z.string(),
		studyPeriod: z.string(),
		course: z.string(),
	}).strict()
}).strict().openapi('CourseOfferingEntity');

const getCourseOffering = z.object({
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	periodId: z.coerce.number().int().optional(),
	periodName: z.string().optional(),
}).openapi('GetCourseOfferingQuery');

authRegistry.addException('GET', '/course-offerings');
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
	const { success, query, error } = requestSafeParse({
		querySchema: getCourseOffering,
		query: req.query,
	});
	if (!success) {
		res.status(400).json(error);
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
		const entities: z.infer<typeof CourseOfferingEntity>[] = courseOfferings.map(co => buildCourseOfferingEntity(co));
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



authRegistry.addException('GET', '/course-offerings/:id');
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
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}
	prisma.courseOffering.findUnique({
		where: {
			id: params.id,
		},
		...prismaCourseOfferingFieldSelection
	}).then((courseOffering) => {
		if (!courseOffering) {
			res.status(404).json({ error: "Course offering not found" });
			return;
		}

		const entity = buildCourseOfferingEntity(courseOffering);
		res.json(entity)
	})
}
router.get('/course-offerings/:id', get)


const createCourseOfferingBody = courseOfferingBase.omit({ id: true }).strict().openapi('CreateCourseOfferingBody');

registry.registerPath({
	method: 'post',
	path: '/course-offerings',
	tags: ['course-offering'],
	request: new RequestBuilder()
		.body(createCourseOfferingBody, "Course offering to create")
		.build(),
	responses: new ResponseBuilder()
		.created(CourseOfferingEntity, "Course offering created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createCourseOfferingBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	
	if (body) {
		const institute = await prisma.institute.findUnique({ where: { id: body.instituteId } });
		if (!institute) {
			errors.addError(['body', 'instituteId'], 'Institute not found');
		}
		
		const course = await prisma.course.findUnique({ where: { id: body.courseId } });
		if (!course) {
			errors.addError(['body', 'courseId'], 'Course not found');
		}
		
		const studyPeriod = await prisma.studyPeriod.findUnique({ where: { id: body.studyPeriodId } });
		if (!studyPeriod) {
			errors.addError(['body', 'studyPeriodId'], 'Study period not found');
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const courseOffering = await prisma.courseOffering.create({
		data: body,
		...prismaCourseOfferingFieldSelection,
	});

	const entity = buildCourseOfferingEntity(courseOffering);
	res.status(201).json(CourseOfferingEntity.parse(entity));
}
router.post('/course-offerings', create)


const patchCourseOfferingBody = courseOfferingBase.omit({ id: true }).partial().strict().openapi('PatchCourseOfferingBody');

registry.registerPath({
	method: 'patch',
	path: '/course-offerings/{id}',
	tags: ['course-offering'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchCourseOfferingBody, "Course offering fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(CourseOfferingEntity, "Course offering updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, params, body, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
		bodySchema: patchCourseOfferingBody,
		body: req.body,
	});
	const validation = new ValidationError('Validation errors', error);

	if (success && body?.instituteId !== undefined) {
		const institute = await prisma.institute.findUnique({ where: { id: body.instituteId } });
		if (!institute) {
			validation.addError(['body', 'instituteId'], 'Institute not found');
		}
	}

	if (success && body?.courseId !== undefined) {
		const course = await prisma.course.findUnique({ where: { id: body.courseId } });
		if (!course) {
			validation.addError(['body', 'courseId'], 'Course not found');
		}
	}

	if (success && body?.studyPeriodId !== undefined) {
		const studyPeriod = await prisma.studyPeriod.findUnique({ where: { id: body.studyPeriodId } });
		if (!studyPeriod) {
			validation.addError(['body', 'studyPeriodId'], 'Study period not found');
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}

	const existing = await prisma.courseOffering.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Course offering not found' });
		return;
	}

	const courseOffering = await prisma.courseOffering.update({
		where: { id: params.id },
		data: {
			...(body.instituteId !== undefined && { instituteId: body.instituteId }),
			...(body.courseId !== undefined && { courseId: body.courseId }),
			...(body.studyPeriodId !== undefined && { studyPeriodId: body.studyPeriodId }),
		},
		...prismaCourseOfferingFieldSelection,
	});

	const entity = buildCourseOfferingEntity(courseOffering);
	res.json(CourseOfferingEntity.parse(entity));
}
router.patch('/course-offerings/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/course-offerings/{id}',
	tags: ['course-offering'],
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

async function deleteCourseOffering(req: Request, res: Response) {
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.courseOffering.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Course offering not found' });
		return;
	}

	await prisma.courseOffering.delete({ where: { id: params.id } });
	res.status(204).send();
}
router.delete('/course-offerings/:id', deleteCourseOffering)

function entityPath(courseOfferingId: number) {
	return `/course-offerings/${courseOfferingId}`;
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
