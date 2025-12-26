import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import { start } from 'repl';
import path from 'path';
import ResponseBuilder from '../ResponseBuilder';
import { ZodErrorResponse } from '../Validation';

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry()

const relatedPathsForStudyPeriod = (studyPeriodId: number) => {
	return {
		courseOfferings: resourcesPaths.courseOffering.list({
			periodId: studyPeriodId
		}),
		classes: resourcesPaths.class.list({
			periodId: studyPeriodId
		}),
		classSchedules: resourcesPaths.classSchedule.list({
			periodId: studyPeriodId
		}),
	}
}

const studyPeriodEntity = z.object({
	id: z.number().int(),
	name: z.string(),
	startDate: z.date(),
	endDate: z.date(),
	_paths: z.object({
		courseOfferings: z.string(),
		classes: z.string(),
		classSchedules: z.string(),
	})
}).strict().openapi('StudyPeriodEntity');

registry.registerPath({
	method: 'get',
	path: '/study-periods',
	tags: ['studyPeriod'],
	responses: new ResponseBuilder()
		.ok(z.array(studyPeriodEntity), "A list of study periods")
		.internalServerError()
		.build(),
});
async function list(req: Request, res: Response) {
	prisma.studyPeriod.findMany().then((studyPeriods) => {
		const entities: z.infer<typeof studyPeriodEntity>[] = studyPeriods.map((studyPeriod) => ({
			...studyPeriod,
			_paths: relatedPathsForStudyPeriod(studyPeriod.id)
		}));

		res.json(z.array(studyPeriodEntity).parse(entities));
	})
}
router.get('/study-periods', list)

registry.registerPath({
	method: 'get',
	path: '/study-periods/{id}',
	tags: ['studyPeriod'],
	request: {
		params: z.object({
			id: z.coerce.number().int(),
		}).strict(),
	},
	responses: new ResponseBuilder()
		.ok(studyPeriodEntity, "A study period by id")
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

	prisma.studyPeriod.findUnique({
		where: {
			id: id,
		},
	}).then((studyPeriod) => {
		if (!studyPeriod) {
			res.status(404).json({ error: "Study period not found" });
			return;
		}
		const entity: z.infer<typeof studyPeriodEntity> = {
			...studyPeriod,
			_paths: relatedPathsForStudyPeriod(studyPeriod.id)
		};

		res.json(studyPeriodEntity.parse(entity));
	})
}

router.get('/study-periods/:id', get)

function entityPath(studyPeriodId: number) {
	return `/study-periods/${studyPeriodId}`;
}

export default {
	router,
	registry,
	paths : {
		entity: entityPath,
	},
}
