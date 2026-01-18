import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import { AuthRegistry } from '../../../auth.js';
import { defaultGetHandler } from '../../../defaultEndpoint.js';
import studentCourseEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler, HandlerFn } from '../../../BuildHandler.js'
import registry from './OpenAPI.js';
import { ValidationError } from '../../../Validation.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

authRegistry.addException('GET', '/courses/:id');

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
	const { path: { sid }, query } = input;
	const studentCourses = await ctx.prisma.studentCourse.findMany({
		...studentCourseEntity.prismaSelection,
		where: {
			studentId: sid,
			...(query?.status && { status: query.status }),
		}
	});
	const entities = studentCourses.map(studentCourseEntity.build);
	return { 200: entities };
}

const get = defaultGetHandler(
	(p) => p.studentCourse,
	studentCourseEntity.prismaSelection,
	studentCourseEntity.build,
	"Student course not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
	const { path: { sid }, body: { courseId, status } } = input;
		
	const course = await ctx.prisma.course.findUnique({ where: { id: courseId } });
	if (!course) {
		const error = new ValidationError();
		error.addError({
			path: ['body', 'courseId'],
			code: 'REFERENCE_NOT_FOUND',
			message: `Course with id ${courseId} not found`,
		});
		return { 400: error };
	}
	
	const existing = await ctx.prisma.studentCourse.findUnique({
		where: {
			studentId_courseId: {
				studentId: sid,
				courseId: courseId,
			}
		}
	});
	
	if (existing) {
		const error = new ValidationError();
		error.addError({
			path: ['body', 'courseId'],
			code: 'ALREADY_EXISTS',
			message: `Student is already enrolled in course ${courseId}`,
		});
		return { 400: error };
	}

	const studentCourse = await ctx.prisma.studentCourse.create({
		...studentCourseEntity.prismaSelection,
		data: {
			studentId: sid,
			courseId,
			status,
		},
	});
	return { 201: studentCourseEntity.build(studentCourse) };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
	const { path: { sid, courseId }, body: { status } } = input;
	
	const existing = await ctx.prisma.studentCourse.findUnique({
		where: { studentId_courseId: { studentId: sid, courseId } }
	});
	
	if (!existing) {
		return { 404: { description: "Student course not found or does not belong to the student" } };
	}

	const studentCourse = await ctx.prisma.studentCourse.update({
		...studentCourseEntity.prismaSelection,
		where: { studentId_courseId: { studentId: sid, courseId } },
		data: { status }
	});
	
	return { 200: studentCourseEntity.build(studentCourse) };
}

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
	const { path: { sid, courseId } } = input;
	
	const existing = await ctx.prisma.studentCourse.findUnique({
		where: { studentId_courseId: { studentId: sid, courseId } }
	});
	
	if (!existing) {
		return { 404: { description: "Student course not found or does not belong to the student" } };
	}
	
	await ctx.prisma.studentCourse.delete({ where: { studentId_courseId: { studentId: sid, courseId } } });
	return { 204: null };
}

router.get('/student/:sid/courses/:courseId', get);

router.get('/student/:sid/courses', buildHandler(IO.list.input, IO.list.output, listFn));

router.post('/student/:sid/courses', buildHandler(IO.create.input, IO.create.output, createFn));

router.patch('/student/:sid/courses/:courseId', buildHandler(IO.patch.input, IO.patch.output, patchFn));

router.delete('/student/:sid/courses/:courseId', buildHandler(IO.remove.input, IO.remove.output, removeFn));

function entityPath(studentId: number, studentCourseId: number) {
	return `/student/${studentId}/courses/${studentCourseId}`;
}

export default {
	router,
	registry,
	authRegistry,
	paths: {
		entity: entityPath,
	},
}
