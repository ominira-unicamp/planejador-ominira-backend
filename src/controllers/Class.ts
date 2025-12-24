import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const getClasses = z.object({
	institute: z.int().optional(),
	course: z.int().optional(),
	period: z.string().optional(),
}).openapi('GetClassesQuery');

registry.registerPath({
	method: 'get',
	path: '/classes',
	tags: ['class'],
	request: {
		query: getClasses,
	},
	responses: {
		200: {
			description: "A list of classes",
			content: {
				'application/json': {
					schema: z.array(z.any()), 
				},
			},
		},
	},
});
async function get(req: Request, res: Response) {
	const query = getClasses.parse(req.query);
	prisma.class.findMany({
		where: {
			coursesOffering: {
				instituteId: query.institute
			},
			courseId: query.course,
			period: query.period,
		}
	}).then((classes) => {
		res.json(classes)
	})
}
router.get('/classes', get)

export default {
	router,
	registry,
}
