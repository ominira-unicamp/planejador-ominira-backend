import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../../../PrismaClient.js'
import { AuthRegistry } from '../../../auth.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import curriculumEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler } from '../../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/curricula/:id');

async function listFn(input: z.infer<typeof IO.list.input>): Promise<z.infer<typeof IO.list.output>> {
	const { path: { sid } } = input;
	const curricula = await prisma.curriculum.findMany({
		...curriculumEntity.prismaSelection,
		where: { studentId: sid }
	});
	const entities = curricula.map(curriculumEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	prisma.curriculum,
	curriculumEntity.prismaSelection,
	curriculumEntity.build,
	"Curriculum not found"
);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { path: { sid } } = input;
	const curriculum = await prisma.curriculum.create({
		...curriculumEntity.prismaSelection,
		data: {
			studentId: sid,
		},
	});
	return { 201: curriculumEntity.build(curriculum) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { sid, id }, body } = input;
	const existing = await prisma.curriculum.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Curriculum not found" } };

	const curriculum = await prisma.curriculum.update({
		...curriculumEntity.prismaSelection,
		where: { id },
		data: {
			...(body.studentId !== undefined && { studentId: body.studentId }),
		},
	});
	return { 200: curriculumEntity.build(curriculum) };
}

async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { sid, id } } = input;
	const existing = await prisma.curriculum.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Curriculum not found" } };
	await prisma.curriculum.delete({ where: { id } });
	return { 204: null };
}

router.get('/student/:sid/curricula/:id', get);

router.get('/student/:sid/curricula', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/student/:sid/curricula', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/student/:sid/curricula/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/student/:sid/curricula/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(studentId: number, curriculumId: number) {
	return `/student/${studentId}/curricula/${curriculumId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
