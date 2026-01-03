

import { Router } from 'express'
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z, { success, ZodAny, ZodType } from 'zod';

import prisma from '../../PrismaClient.js'
import { AuthRegistry } from '../../auth.js';
import { resourcesPaths } from '../../Controllers.js';
import ResponseBuilder from '../../openapi/ResponseBuilder.js';
import { ValidationError, ValidationErrorField, ValidationErrorType, ZodToApiError } from '../../Validation.js';
import RequestBuilder from '../../openapi/RequestBuilder.js';
import { ParamsDictionary } from 'express-serve-static-core';
import { defaultGetHandler, defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import studyPeriodEntity from './Entity.js';
import IO  from './Interface.js';
import { buildHandler } from '../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/study-periods');
async function listFn(input : z.infer<typeof IO.list.input>) : Promise<z.infer<typeof IO.list.output>> {
	const studyPeriods = await prisma.studyPeriod.findMany();
	const entities = studyPeriods.map(studyPeriodEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	prisma.studyPeriod,
	{},
	studyPeriodEntity.build,
	"Study period not found"
);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { body } = input;
	const existing = await prisma.studyPeriod.findFirst({ where: { code: body.code } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "code"],
				message: "A study period with this code already exists"
			}])
		};
	}
	const studyPeriod = await prisma.studyPeriod.create({
		data: {
			code: body.code,
			startDate: body.startDate,
		},
	});
	return { 201: studyPeriodEntity.build(studyPeriod) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	const existing = await prisma.studyPeriod.findUnique({ where: { id } });
	if (!existing) 
		return { 404: { description: "Study period not found" } };
	
	const studyPeriod = await prisma.studyPeriod.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.startDate !== undefined && { startDate: body.startDate }),
		},
	});
	return { 200: studyPeriodEntity.build(studyPeriod) };
}


async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.studyPeriod.findUnique({ where: { id } });
	if (!existing) 
		return { 404: { description: "Study period not found" } };
	await prisma.studyPeriod.delete({ where: { id } });
	return { 204: null };
}

router.get('/study-periods/:id', get)

router.get('/study-periods', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/study-periods', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/study-periods/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/study-periods/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));


function entityPath(studyPeriodId: number) {
	return `/study-periods/${studyPeriodId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
