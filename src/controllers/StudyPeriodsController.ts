import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z, { success, ZodAny, ZodType } from 'zod';

import prisma from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { requestSafeParse, ValidationErrorField, ValidationErrorType, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { ParamsDictionary } from 'express-serve-static-core';

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
const studyPeriodBase = z.object({
	id: z.number().int(),
	code: z.string(),
	startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
}).strict();

const studyPeriodEntity = studyPeriodBase.extend({
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

const createStudyPeriodBody = studyPeriodBase.omit({ id: true }).openapi('CreateStudyPeriodBody');

registry.registerPath({
	method: 'post',
	path: '/study-periods',
	tags: ['studyPeriod'],
	request: new RequestBuilder()
		.body(createStudyPeriodBody, "Study period to create")
		.build(),
	responses: new ResponseBuilder()
		.created(studyPeriodEntity, "Study period created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createStudyPeriodBody.safeParse(req.body);
	const validationErrors = []
	if (!success)
		validationErrors.push(...ZodErrorResponse(["body"], error));

	if (body) {
		const existing = await prisma.studyPeriod.findFirst({ where: { code: body.code } });
		if (existing)
			validationErrors.push({ error: "A study period with this code already exists", path: ["body", "code"] });
	}
	if (validationErrors.length > 0 || !success) {
		res.status(400).json(validationErrors);
		return;
	}

	const studyPeriod = await prisma.studyPeriod.create({
		data: {
			code: body.code,
			startDate: body.startDate,
		},
	});

	const entity: z.infer<typeof studyPeriodEntity> = {
		...studyPeriod,
		_paths: relatedPathsForStudyPeriod(studyPeriod.id),
	};

	res.status(201).json(studyPeriodEntity.encode(entity));
}
router.post('/study-periods', create)


const patchStudyPeriodBody = studyPeriodBase
	.omit({ id: true })
	.partial()
	.strict()
	.openapi('PatchStudyPeriodBody');

registry.registerPath({
	method: 'patch',
	path: '/study-periods/{id}',
	tags: ['studyPeriod'],
	request: new RequestBuilder()
		.params(z.object({
			id: z.int(),
		}).strict())
		.body(patchStudyPeriodBody, "Study period fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(studyPeriodEntity, "Study period patched successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {

	const {params, body , success, error } = requestSafeParse({
		paramsSchema: z.object({
			id: z.coerce.number().int(),
		}).strict(),
		params: req.params,
		bodySchema: patchStudyPeriodBody,
		body: req.body,
	})
	if (!success) {
		res.status(400).json(error);
		return;
	}	
	const id = params!.id;
	const existing = await prisma.studyPeriod.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: "Study period not found" });
		return;
	}

	const studyPeriod = await prisma.studyPeriod.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.startDate !== undefined && { startDate: body.startDate }),
		},
	});

	const entity: z.infer<typeof studyPeriodEntity> = {
		...studyPeriod,
		_paths: relatedPathsForStudyPeriod(studyPeriod.id),
	};

	res.json(studyPeriodEntity.parse(entity));
}
router.patch('/study-periods/:id', patch)

registry.registerPath({
	method: 'delete',
	path: '/study-periods/{id}',
	tags: ['studyPeriod'],
	request: {
		params: z.object({
			id: z.int(),
		}).strict(),
	},
	responses: new ResponseBuilder()
		.noContent()
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function remove(req: Request, res: Response) {
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["params", "id"], error));
		return;
	}
	const existing = await prisma.studyPeriod.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: "Study period not found" });
		return;
	}

	await prisma.studyPeriod.delete({ where: { id } });
	res.status(204).send();
}
router.delete('/study-periods/:id', remove)

function entityPath(studyPeriodId: number) {
	return `/study-periods/${studyPeriodId}`;
}

export default {
	router,
	registry,
	paths: {
		entity: entityPath,
	},
}

