import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const getCourse = z.object({
	institute: z.int().optional(),
}).openapi('GetCourseQuery');

registry.registerPath({
	method: 'get',
	path: '/courses',
	tags: ['course'],
	request: {
		query: getCourse,
	},
	responses: {
		200: {
			description: "A list of courses",
			content: {
				'application/json': {
					schema: z.array(z.any()), 
				},
			},
		},
	},
});
async function get(req: Request, res: Response) {
	const query = getCourse.parse(req.query);
	prisma.course.findMany().then((courses) => {
		res.json(courses)
	})
}
router.get('/courses', get)

export default {
	router,
	registry,
}
