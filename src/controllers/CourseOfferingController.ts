import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const getCourseOffering = z.object({
	institute: z.int().optional(),
	course: z.int().optional(),
	period: z.int().optional(),
}).openapi('GetCourseOfferingQuery');
registry.registerPath({
	method: 'get',
	path: '/course-offerings',
	tags: ['courseOffering'],
	request: {
		query: getCourseOffering,
	},
	responses: {
		200: {
			description: "A list of course offerings",
			content: {
				'application/json': {
					schema: z.array(z.any()), 
				},
			},
		},
	},
});
async function get(req: Request, res: Response) {
	const query = getCourseOffering.parse(req.query);
	prisma.courseOffering.findMany({
		where: {
			instituteId: query.institute,
			courseId: query.course,
			studyPeriodId: query.period,
		}
	}).then((courseOfferings) => {
		res.json(courseOfferings)
	})
}
router.get('/course-offerings', get)

export default {
	router,
	registry,
}
