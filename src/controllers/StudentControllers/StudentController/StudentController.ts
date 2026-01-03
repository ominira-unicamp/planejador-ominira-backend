import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../../../PrismaClient.js'
import { AuthRegistry } from '../../../auth.js';
import { ValidationError } from '../../../Validation.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import studentEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler } from '../../../BuildHandler.js';
import registry from './OpenAPI.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

async function listFn(input: z.infer<typeof IO.list.input>): Promise<z.infer<typeof IO.list.output>> {
	const students = await prisma.student.findMany();
	const entities = students.map(studentEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	prisma.student,
	{},
	studentEntity.build,
	"Student not found"
);

async function createFn(input: z.infer<typeof IO.create.input>): Promise<z.infer<typeof IO.create.output>> {
	const { body } = input;
	const existing = await prisma.student.findFirst({ where: { ra: body.ra } });
	if (existing) {
		return {
			400: new ValidationError([{
				code: "ALREADY_EXISTS",
				path: ["body", "ra"],
				message: "A student with this RA already exists"
			}])
		};
	}
	const student = await prisma.student.create({
		data: {
			ra: body.ra,
			name: body.name,
			programId: body.programId,
			modalityId: body.modalityId,
			catalogId: body.catalogId,
		},
	});
	return { 201: studentEntity.build(student) };
}

async function patchFn(input: z.infer<typeof IO.patch.input>): Promise<z.infer<typeof IO.patch.output>> {
	const { path: { id }, body } = input;
	const existing = await prisma.student.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Student not found" } };

	const student = await prisma.student.update({
		where: { id },
		data: {
			...(body.ra !== undefined && { ra: body.ra }),
			...(body.name !== undefined && { name: body.name }),
			...(body.programId !== undefined && { programId: body.programId }),
			...(body.modalityId !== undefined && { modalityId: body.modalityId }),
			...(body.catalogId !== undefined && { catalogId: body.catalogId }),
		},
	});
	return { 200: studentEntity.build(student) };
}

async function removeFn(input: z.infer<typeof IO.remove.input>): Promise<z.infer<typeof IO.remove.output>> {
	const { path: { id } } = input;
	const existing = await prisma.student.findUnique({ where: { id } });
	if (!existing)
		return { 404: { description: "Student not found" } };
	await prisma.student.delete({ where: { id } });
	return { 204: null };
}

router.get('/students/:id', get);

router.get('/students', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/students', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/students/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/students/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(studentId: number) {
	return `/students/${studentId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
