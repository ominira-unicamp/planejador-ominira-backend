import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../../auth.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import periodPlanningEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, Context, HandlerFn } from '../../../BuildHandler.js'
import registry from './OpenAPI.js';
import { Prisma, PrismaClient } from '../../../../prisma/generated/client.js';
import { ErrorFieldType, ValidationError } from '../../../Validation.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/period-plan/:id');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const { path: { sid } } = input;
	const periodPlans = await ctx.prisma.periodPlanning.findMany({
		...periodPlanningEntity.prismaSelection,
		where: { studentId: sid }
	});
	const entities = periodPlans.map(periodPlanningEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.periodPlanning,
	periodPlanningEntity.prismaSelection,
	periodPlanningEntity.build,
	"PeriodPlanning not found"
);


async function validateClasses(
	prisma: PrismaClient,
	classIds: Set<number>,
	studyPeriodId: number,
	getPathForClassId: (classId: number) => string[]
): Promise<ValidationError | null> {
	const validationError = new ValidationError();
	validationError.addErrors(await validateClassesBelongToStudyPeriod(
		prisma,
		classIds,
		studyPeriodId,
		getPathForClassId
	));
	validationError.addErrors(await validateNoDuplicateCourses(
		prisma,
		classIds,
		getPathForClassId
	));
	if (validationError.errors.length > 0) {
		return validationError;
	}
	return null;
}

async function validateClassesBelongToStudyPeriod(
	prisma: PrismaClient,
	classIds: Set<number>,
	expectedStudyPeriodId: number,
	getPathForClassId: (classId: number) => string[]
): Promise<ErrorFieldType[]> {
	if (classIds.size === 0) {
		return [];
	}

	const classesData = await prisma.class.findMany({
		where: { id: { in: [...classIds] } },
		select: { id: true, studyPeriodId: true },
	});
	const error: ErrorFieldType[] = [];

	if (classesData.length !== classIds.size) {
		const notFoundIds = Array.from(classIds).filter(id => !classesData.some(c => c.id === id));
		notFoundIds.forEach(id => {
			error.push({
				code: 'REFERENCE_NOT_FOUND',
				path: getPathForClassId(id),
				message: `Class with id ${id} not found`,
			});
		});
	}

	const invalidClasses = classesData.filter(c => c.studyPeriodId !== expectedStudyPeriodId);
	invalidClasses.forEach(c => {
		error.push({
			code: 'INVALID_VALUE',
			path: getPathForClassId(c.id),
			message: `Class ${c.id} belongs to study period ${c.studyPeriodId}, but planning is for study period ${expectedStudyPeriodId}`,
		});
	});

	return error;
}

async function validateNoDuplicateCourses(
	prisma: PrismaClient,
	classIds: Set<number>,
	getPathForClassId: (classId: number) => string[]
): Promise<ErrorFieldType[]> {
	if (classIds.size === 0) {
		return [];
	}
	const errors: ErrorFieldType[] = []
	const classesData = await prisma.class.findMany({
		where: { id: { in: [...classIds] } },
		select: { id: true, courseId: true },
	});

	const seenCourses = new Set<number>();
	const duplicates: Array<{ courseId: number; classId: number }> = [];

	for (const classData of classesData) {
		if (seenCourses.has(classData.courseId)) {
			duplicates.push({ courseId: classData.courseId, classId: classData.id });
		} else {
			seenCourses.add(classData.courseId);
		}
	}

	duplicates.forEach(({ courseId, classId }) => {
		errors.push({
			code: 'INVALID_VALUE',
			path: getPathForClassId(classId),
			message: `Multiple classes for the same course (courseId: ${courseId}) are not allowed in a planning`,
		});
	});

	return errors;
}

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { path: { sid }, body: { studyPeriodId, classes } } = input;
	const studyPeriod = await ctx.prisma.studyPeriod.findUnique({
		where: { id: studyPeriodId }
	});
	if (!studyPeriod) {
		const error = new ValidationError();
		error.addError({
			path: ['body', 'studyPeriodId'],
			code: 'REFERENCE_NOT_FOUND',
			message: `StudyPeriod with id ${studyPeriodId} not found`,
		})
		return { 400: error };
	}

	const validationError = await validateClasses(
		ctx.prisma,
		classes,
		studyPeriodId,
		() => ['body', 'classes']
	);
	if (validationError) {
		return { 400: validationError };
	}

	const periodPlanning = await ctx.prisma.periodPlanning.create({
		...periodPlanningEntity.prismaSelection,
		data: {
			studentId: sid,
			studyPeriodId,
			classes: {
				connect: [...classes].map(id => ({ id })),
			},
		},
	});
	return { 201: periodPlanningEntity.build(periodPlanning) };
}

function buildClassUpdateData(ops: z.infer<typeof IO.patch.input>["body"]["classes"]) {
	if (ops.set)
		return { set: [...ops.set].map(id => ({ id })) }
	return {
		disconnect: ops.remove ? [...ops.remove].map(id => ({ id })) : undefined,
		connect: ops.add ? [...ops.add].map(id => ({ id })) : undefined,
	};
}


const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { sid, id }, body } = input;
	const existing = await ctx.prisma.periodPlanning.findUnique({
		where: {
			studentId: sid,
			id
		}
	});
	if (!existing)
		return { 404: { description: "PeriodPlanning not found or does not belong to the student" } };

	if (body.classes) {
		const classIdsToValidate: Set<number> = new Set([
			...(body.classes.set || []),
			...(body.classes.add || [])
		]);
		let finalClassIds: Set<number> = new Set();
		if (body.classes.set) {
			finalClassIds = body.classes.set;
		} else {
			const currentPlanning = await ctx.prisma.periodPlanning.findUnique({
				where: { id },
				select: { classes: { select: { id: true } } }
			});
			const currentSet = new Set(currentPlanning?.classes.map(c => c.id) || []);

			finalClassIds = currentSet
				.union(body.classes.add ?? new Set<number>())
				.difference(body.classes.remove ?? new Set<number>());
		}
		const validationError = await validateClasses(
			ctx.prisma,
			classIdsToValidate,
			existing.studyPeriodId,
			(classId) => ['body', 'classes', body.classes.set ? "set" : 'add']
		);

		if (validationError) {
			return { 400: validationError };
		}

		const classesUpdate = buildClassUpdateData(body.classes);
		const periodPlanning = await ctx.prisma.periodPlanning.update({
			...periodPlanningEntity.prismaSelection,
			where: { id },
			data: { classes: classesUpdate }
		});
		return { 200: periodPlanningEntity.build(periodPlanning) };
	}

	// No changes requested, return current state
	return { 200: periodPlanningEntity.build(existing as any) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { sid, id } } = input;
	const existing = await ctx.prisma.periodPlanning.findUnique({
		where: {
			studentId: sid,
			id
		}
	});
	if (!existing)
		return { 404: { description: "PeriodPlanning not found or does not belong to the student" } };
	await ctx.prisma.periodPlanning.delete({ where: { studentId: sid, id } });
	return { 204: null };
}

router.get('/student/:sid/period-plan/:id', get);

router.get('/student/:sid/period-plan', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/student/:sid/period-plan', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/student/:sid/period-plan/:id', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/student/:sid/period-plan/:id', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(studentId: number, periodPlanningId: number) {
	return `/student/${studentId}/period-plan/${periodPlanningId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
