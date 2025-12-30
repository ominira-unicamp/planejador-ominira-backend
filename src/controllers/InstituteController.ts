import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma, { MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { ValidationError, ZodToApiError } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { zodIds } from '../PrismaValidator';
import { defaultGetHandler, defaultOpenApiGetPath } from '../defaultEndpoint';

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
registry.registerPath(defaultOpenApiGetPath('/institutes/{id}', 'institute', instituteEntity, "An institute by id"));
router.get('/institutes/:id', defaultGetHandler(
	prisma.institute,
	{},
	buildInstituteEntity,
	"Institute not found"
))


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
	const errors = new ValidationError([]);
	if (!success) {
		errors.addErrors(ZodToApiError(error, ['body']));
	}
	
	if (body) {
		const existing = await prisma.institute.findUnique({ where: { code: body.code } });
		if (existing) {
			errors.addError({
				code: "ALREADY_EXISTS",
				path: ['body', 'code'],
				message: 'An institute with this code already exists'
			});
		}
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const institute = await prisma.institute.create({
		data: body,
	});

	res.status(201).json(buildInstituteEntity(institute));
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
	const { success, data, error } = await z.object({
		params: z.object({ id: z.coerce.number().int().pipe(zodIds.institute.exists) }),
		body: patchInstituteBody,
	}).safeParseAsync(req);

	const validation = new ValidationError(ZodToApiError(error));

	if (success) {
		const existing = await prisma.institute.findUnique({ where: { code: data.body.code } });
		if (existing && existing.id !== data.params.id) {
			validation.addError({
				code: "ALREADY_EXISTS",
				path: ['body', 'code'],
				message: 'An institute with this code already exists'
			});
		}
	}

	if (!success || validation.errors.length > 0) {
		res.status(400).json(validation);
		return;
	}
	const { params, body } = data;
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

	res.json(buildInstituteEntity(institute));
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
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(new ValidationError(ZodToApiError(error, ["path", "id"])));
		return;
	}

	const existing = await prisma.institute.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: 'Institute not found' });
		return;
	}

	await prisma.institute.delete({ where: { id: id } });
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
