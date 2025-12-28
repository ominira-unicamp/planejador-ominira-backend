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
const registry = new OpenAPIRegistry()

type PrismaInstitutePayload = MyPrisma.InstituteGetPayload<{}>;

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

function buildInstituteEntity(institute: PrismaInstitutePayload): z.infer<typeof instituteEntity> {
	return {
		...institute,
		_paths: relatedPathsForInstitute(institute.id)
	};
}

const instituteBase = z.object({
	id: z.number().int(),
	code: z.string().min(1),
});

const instituteEntity = instituteBase.extend({
	_paths: z.object({
		classes: z.string(),
		coursesOfferings: z.string(),
		courses: z.string(),
	}).strict()
}).strict().openapi('InstituteEntity');

authRegistry.addException('GET', '/institutes');
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
		const entities = institutes.map(institute => buildInstituteEntity(institute));
		res.json(entities)
	})
}
router.get('/institutes', list)

authRegistry.addException('GET', '/institutes/:id');
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
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	prisma.institute.findUnique({
		where: {
			id: params.id,
		}
	}).then((institute) => {
		if (!institute) {
			res.status(404).json({ error: "Institute not found" });
			return;
		}

		const entity = buildInstituteEntity(institute);
		res.json(entity)
	})
}
router.get('/institutes/:id', get)


const createInstituteBody = instituteBase.omit({ id: true }).strict().openapi('CreateInstituteBody');

registry.registerPath({
	method: 'post',
	path: '/institutes',
	tags: ['institute'],
	request: new RequestBuilder()
		.body(createInstituteBody, "Institute to create")
		.build(),
	responses: new ResponseBuilder()
		.created(instituteEntity, "Institute created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createInstituteBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	
	if (body) {
		const existing = await prisma.institute.findUnique({ where: { code: body.code } });
		if (existing) {
			errors.addError(['body', 'code'], 'An institute with this code already exists');
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const institute = await prisma.institute.create({
		data: body,
	});

	const entity = buildInstituteEntity(institute);
	res.status(201).json(instituteEntity.parse(entity));
}
router.post('/institutes', create)


const patchInstituteBody = instituteBase.omit({ id: true }).partial().strict().openapi('PatchInstituteBody');

registry.registerPath({
	method: 'patch',
	path: '/institutes/{id}',
	tags: ['institute'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchInstituteBody, "Institute fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(instituteEntity, "Institute updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, params, body, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
		bodySchema: patchInstituteBody,
		body: req.body,
	});
	const validation = new ValidationError('Validation errors', error);

	if (success && body?.code !== undefined) {
		const existing = await prisma.institute.findUnique({ where: { code: body.code } });
		if (existing && existing.id !== params.id) {
			validation.addError(['body', 'code'], 'An institute with this code already exists');
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}

	const existing = await prisma.institute.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Institute not found' });
		return;
	}

	const institute = await prisma.institute.update({
		where: { id: params.id },
		data: {
			...(body.code !== undefined && { code: body.code }),
		},
	});

	const entity = buildInstituteEntity(institute);
	res.json(instituteEntity.parse(entity));
}
router.patch('/institutes/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/institutes/{id}',
	tags: ['institute'],
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

async function deleteInstitute(req: Request, res: Response) {
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.institute.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Institute not found' });
		return;
	}

	await prisma.institute.delete({ where: { id: params.id } });
	res.status(204).send();
}
router.delete('/institutes/:id', deleteInstitute)

function entityPath(instituteId: number) {
	return `/institutes/${instituteId}`;
}
export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
