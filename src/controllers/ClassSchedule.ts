import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'
extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const getClassSchedules = z.object({
	institute: z.int().optional(),
	course: z.int().optional(),
	period: z.string().optional(),
	class: z.int().optional(),
	dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
}).openapi('GetClassSchedulesQuery');

registry.registerPath({
	method: 'get',
	path: '/class-schedules',
	tags: ['class-schedule'],
	request: {
		query: getClassSchedules,
	},
	responses: {
		200: {
			description: "A list of class schedules",
			content: {
				'application/json': {
					schema: z.array(z.any()), 
				},
			},
		},
	},
});
async function get(req: Request, res: Response) {
	const query = getClassSchedules.parse(req.query);
	prisma.classSchedule.findMany({
		where: {
			dayOfWeek: query.dayOfWeek || undefined,
			roomId: query.class || undefined,
			class: {
				coursesOffering: {
					instituteId: query.institute || undefined,
				},
				courseId: query.course || undefined,
				period: query.period || undefined,
			},
		}
	}).then((classes) => {
		res.json(classes)
	})
}
router.get('/class-schedules', get)

export default {
	router,
	registry,
}
