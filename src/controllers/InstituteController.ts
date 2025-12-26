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
const registry = new OpenAPIRegistry()

function relatedPathsForInstitute(instituteId: number) {
	return {
		classes: resourcesPaths.class.list({
			instituteId: instituteId
		}),
		coursesOfferings: resourcesPaths.courseOffering.list({
			instituteId: instituteId
		}),
		courses: resourcesPaths.course.list({instituteId: instituteId})
	}
}

const instituteEntity = z.object({
	id: z.number().int(),
	name: z.string(),
	_paths: z.object({
		classes: z.string(),
		coursesOfferings: z.string(),
		courses: z.string(),
	})
}).strict().openapi('InstituteEntity');

registry.registerPath({
	method: 'get',
	path: '/institutes',
	tags: ['institute'],
	responses: new ResponseBuilder()
		.ok(z.array(instituteEntity), "A list of institutes")
		.internalServerError()
		.build(),
});
async function list(req: Request, res: Response) {
	prisma.institute.findMany().then((institutes) => {
		res.json(
			institutes.map(institute => ({
				...institute,
				_paths: relatedPathsForInstitute(institute.id)
			})),
		)
	})
}
router.get('/institutes', list)

registry.registerPath({
	method: 'get',
	path: '/institutes/{id}',
	tags: ['institute'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(instituteEntity, "An institute by id")
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

	prisma.institute.findUnique({
		where: {
			id: id,
		}
	}).then((institute) => {
		if (!institute) {
			res.status(404).send({ error: "Institute not found" });
			return;
		}

		res.json(
			{
				...institute,
				_paths: relatedPathsForInstitute(institute.id)
			} 
		)
	})
}
router.get('/institutes/:id', get)

function entityPath(instituteId: number) {
	return `/institutes/${instituteId}`;
}
export default {
	router,
	registry,
	paths: {
		entity: entityPath,
	}
}
