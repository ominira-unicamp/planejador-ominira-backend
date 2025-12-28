import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { requestSafeParse, ValidationError, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

type PrismaCoursePayload = MyPrisma.CourseGetPayload<{}>;


function relatedPathsForCourse(courseId: number) {
	return {
		classes: resourcesPaths.class.list({courseId}),
	}
}

function buildCourseEntity(course: PrismaCoursePayload): z.infer<typeof courseEntity> {
	return {
		...course,
		_paths: relatedPathsForCourse(course.id)
	};
}

const courseBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
	name: z.string().min(1),
	credits: z.number().int().min(0),
	instituteId: z.number().int(),
});

const courseEntity = courseBase.extend({
	_paths: z.object({
		classes: z.string(),
	}).strict()
}).strict().openapi('CourseEntity');

authRegistry.addException('GET', '/courses');
registry.registerPath({
	method: 'get',
	path: '/courses',
	tags: ['course'],
	responses: new ResponseBuilder()
		.ok(z.array(courseEntity), "A list of courses")
		.internalServerError()
		.build(),
});
async function list(req: Request, res: Response) {
	prisma.course.findMany().then((courses) => {
		const entities : z.infer<typeof courseEntity>[] = courses.map((course) => buildCourseEntity(course))
		res.json(z.array(courseEntity).parse(entities));
	})
}
router.get('/courses', list)
interface ListQueryParams{
	instituteId?: number,
}

function listPath({
	instituteId,
} : ListQueryParams) {
	return `/courses?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
	].filter(Boolean).join('&');
} 

authRegistry.addException('GET', '/courses/:id');
registry.registerPath({
	method: 'get',
	path: '/courses/{id}',
	tags: ['course'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(courseEntity, "A course by id")
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
	prisma.course.findUnique({
		where: {
			id: params.id,
		},
	}).then((course) => {
		if (!course) {
			res.status(404).json({ error: "Course not found" });
			return;
		}
		const entity = buildCourseEntity(course);
		res.json(courseEntity.parse(entity))
	})
}

router.get('/courses/:id', get)

function entityPath(courseId: number) {
	return `/courses/${courseId}`;
}


const createCourseBody = courseBase.omit({ id: true }).strict().openapi('CreateCourseBody');

registry.registerPath({
	method: 'post',
	path: '/courses',
	tags: ['course'],
	request: new RequestBuilder()
		.body(createCourseBody, "Course to create")
		.build(),
	responses: new ResponseBuilder()
		.created(courseEntity, "Course created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createCourseBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	
	if (body) {
		const existing = await prisma.course.findUnique({ where: { code: body.code } });
		if (existing) {
			errors.addError(['body', 'code'], 'A course with this code already exists');
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const course = await prisma.course.create({
		data: body,
	});

	const entity = buildCourseEntity(course);
	res.status(201).json(courseEntity.parse(entity));
}
router.post('/courses', create)


const patchCourseBody = courseBase.omit({ id: true }).partial().strict().openapi('PatchCourseBody');

registry.registerPath({
	method: 'patch',
	path: '/courses/{id}',
	tags: ['course'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchCourseBody, "Course fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(courseEntity, "Course updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, params, body, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
		bodySchema: patchCourseBody,
		body: req.body,
	});
	const validation = new ValidationError('Validation errors', error);

	if (success && body?.code !== undefined) {
		const existing = await prisma.course.findUnique({ where: { code: body.code } });
		if (existing && existing.id !== params.id) {
			validation.addError(['body', 'code'], 'A course with this code already exists');
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}

	const existing = await prisma.course.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Course not found' });
		return;
	}

	const course = await prisma.course.update({
		where: { id: params.id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.name !== undefined && { name: body.name }),
			...(body.credits !== undefined && { credits: body.credits }),
		},
	});

	const entity = buildCourseEntity(course);
	res.json(courseEntity.parse(entity));
}
router.patch('/courses/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/courses/{id}',
	tags: ['course'],
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

async function deleteCourse(req: Request, res: Response) {
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.course.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Course not found' });
		return;
	}

	await prisma.course.delete({ where: { id: params.id } });
	res.status(204).send();
}
router.delete('/courses/:id', deleteCourse)


export default {
	router,
	registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
}
