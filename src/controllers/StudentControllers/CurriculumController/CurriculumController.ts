import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../../auth.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import curriculumEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, Context, HandlerFn } from '../../../BuildHandler.js'
import registry from './OpenAPI.js';
import { PrismaClient } from '../../../../prisma/generated/client.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/curricula/:id');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const { path: { sid } } = input;
	const curricula = await ctx.prisma.curriculum.findMany({
		...curriculumEntity.prismaSelection,
		where: { studentId: sid }
	});
	const entities = curricula.map(curriculumEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.curriculum,
	curriculumEntity.prismaSelection,
	curriculumEntity.build,
	"Curriculum not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { path: { sid } } = input;
	const curriculum = await ctx.prisma.curriculum.create({
		...curriculumEntity.prismaSelection,
		data: {
			studentId: sid,
		},
	});
	return { 201: curriculumEntity.build(curriculum) };
}

type TxType = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">

async function patchCourse(tx: TxType, ops: z.infer<typeof IO.patch.input>["body"]["courses"], curriculumId: number) {
	if (ops.set) {
		await tx.curriculumCourse.deleteMany({
			where: {
				curriculumId,
			},
		});
		await tx.curriculumCourse.createMany({
			data: ops.set.map(({ courseId, semester }) => ({
				curriculumId,
				courseId,
				semester,
			})),
			skipDuplicates: true,
		});
		return;
	}
	if (ops.remove) {
		await tx.curriculumCourse.deleteMany({
			where: {
				curriculumId: curriculumId,
				courseId: { in: ops.remove },
			},
		});
	}
	if (ops.add) {
		await tx.curriculumCourse.createMany({
			data: ops.add.map(({ courseId, semester }) => ({
				curriculumId,
				courseId,
				semester,
			})),
			skipDuplicates: true,
		});
	}
	if (ops.upsert) {
		await Promise.all(
			ops.upsert.map(({ courseId, semester }) =>
				tx.curriculumCourse.upsert({
					where: {
						curriculumId_courseId: {
							curriculumId,
							courseId,
						},
					},
					create: {
						curriculumId,
						courseId,
						semester,
					},
					update: {
						semester,
					},
				})
			)
		);
	}
	if (ops.update) {
		await Promise.all(
			ops.update.map(({ courseId, semester }) =>
				tx.curriculumCourse.update({
					where: {
						curriculumId_courseId: {
							curriculumId,
							courseId,
						},
					},
					data: {
						semester: semester,
					}
				})
			)
		);
	}
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { sid, id }, body } = input;
	const existing = await ctx.prisma.curriculum.findUnique({
		where: {
			studentId: sid,
			id
		}
	});
	if (!existing)
		return { 404: { description: "Curriculum not found or does not belong to the student" } };

	if (body.courses) {
		await ctx.prisma.$transaction(async (tx) => {
			await patchCourse(tx, body.courses, id);
		});
	}
	const curriculum = await ctx.prisma.curriculum.update({
		...curriculumEntity.prismaSelection,
		where: {
			studentId: sid,
			id
		},
		data: {
			...(body.studentId !== undefined && { studentId: body.studentId }),
		},
	});
	return { 200: curriculumEntity.build(curriculum) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { sid, id } } = input;
	const existing = await ctx.prisma.curriculum.findUnique({
		where: {
			studentId: sid,
			id
		}
	});
	if (!existing)
		return { 404: { description: "Curriculum not found or does not belong to the student" } };
	await ctx.prisma.curriculum.delete({ where: { studentId: sid, id } });
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
