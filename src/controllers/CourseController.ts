import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../ResponseBuilder';
import { ZodErrorResponse } from '../Validation';
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

function relatedPathsForCourse(courseId: number) {
	return {
		classes: resourcesPaths.class.list({courseId}),
		courseOfferings: resourcesPaths.courseOffering.list({courseId}),
	}
}

const courseEntity = z.object({
	id: z.number().int(),
	code: z.string(),
	name: z.string(),
	credits: z.number().int(),
	_paths: z.object({
		classes: z.string(),
		courseOfferings: z.string(),
	}).strict()
}).strict().openapi('CourseEntity');

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
		const entities : z.infer<typeof courseEntity>[] = courses.map((course) => ({
			...course,
			_paths: relatedPathsForCourse(course.id)
		}))
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
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["params", "id"], error));
		return;
	}
	prisma.course.findUnique({
		where: {
			id: id,
		},
	}).then((course) => {
		if (!course) {
			res.status(404).json({ error: "Course not found" });
			return;
		}
		const entity : z.infer<typeof courseEntity> = {
			...course,
			_paths: relatedPathsForCourse(course.id)
		}
		res.json(courseEntity.parse(entity))
	})
}

router.get('/courses/:id', get)

function entityPath(courseId: number) {
	return `/courses/${courseId}`;
}
export default {
	router,
	registry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
}
