import { Router } from 'express'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../../../PrismaClient.js'
import { AuthRegistry } from '../../../auth.js';
import curriculumCourseEntity from './Entity.js';
import IO from './Interface.js';
import { buildHandler } from '../../../BuildHandler.js';
import registry from './OpenAPI.js';
import { zodIds } from '../../../PrismaValidator.js';
import { ValidationError, ZodToApiError } from '../../../Validation.js';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();

async function addCourseFn(input: z.infer<typeof IO.addCourse.input>): Promise<z.infer<typeof IO.addCourse.output>> {
	const { path: { sid, cid }, body } = input;
	
	const curriculum = await prisma.curriculum.findUnique({ where: { id: cid } });
	if (!curriculum || curriculum.studentId !== sid)
		return { 404: { description: "Curriculum not found for this student" } };

	const courseIdCheck = await zodIds.course.exists.safeParseAsync(body.courseId);
	if (!courseIdCheck.success)
		throw new ValidationError(ZodToApiError(courseIdCheck.error));

	const curriculumCourse = await prisma.curriculumCourse.create({
		...curriculumCourseEntity.prismaSelection,
		data: {
			curriculumId: cid,
			courseId: body.courseId,
			semester: body.semester,
		},
	});
	return { 201: curriculumCourseEntity.build(curriculumCourse) };
}

async function updateCourseFn(input: z.infer<typeof IO.updateCourse.input>): Promise<z.infer<typeof IO.updateCourse.output>> {
	const { path: { sid, cid, courseId }, body } = input;
	
	const curriculum = await prisma.curriculum.findUnique({ where: { id: cid } });
	if (!curriculum || curriculum.studentId !== sid)
		return { 404: { description: "Curriculum not found for this student" } };

	const existing = await prisma.curriculumCourse.findUnique({
		where: {
			curriculumId_courseId: {
				curriculumId: cid,
				courseId: courseId,
			}
		}
	});
	if (!existing)
		return { 404: { description: "Course not found in curriculum" } };

	const curriculumCourse = await prisma.curriculumCourse.update({
		...curriculumCourseEntity.prismaSelection,
		where: {
			curriculumId_courseId: {
				curriculumId: cid,
				courseId: courseId,
			}
		},
		data: {
			...(body.semester !== undefined && { semester: body.semester }),
		},
	});
	return { 200: curriculumCourseEntity.build(curriculumCourse) };
}

async function removeCourseFn(input: z.infer<typeof IO.removeCourse.input>): Promise<z.infer<typeof IO.removeCourse.output>> {
	const { path: { sid, cid, courseId } } = input;
	
	const curriculum = await prisma.curriculum.findUnique({ where: { id: cid } });
	if (!curriculum || curriculum.studentId !== sid)
		return { 404: { description: "Curriculum not found for this student" } };

	const existing = await prisma.curriculumCourse.findUnique({
		where: {
			curriculumId_courseId: {
				curriculumId: cid,
				courseId: courseId,
			}
		}
	});
	if (!existing)
		return { 404: { description: "Course not found in curriculum" } };

	await prisma.curriculumCourse.delete({
		where: {
			curriculumId_courseId: {
				curriculumId: cid,
				courseId: courseId,
			}
		}
	});
	return { 204: null };
}

router.post('/student/:sid/curricula/:cid/courses', buildHandler(IO.addCourse.input, IO.addCourse.output, addCourseFn));

router.patch('/student/:sid/curricula/:cid/courses/:courseId', buildHandler(IO.updateCourse.input, IO.updateCourse.output, updateCourseFn));

router.delete('/student/:sid/curricula/:cid/courses/:courseId', buildHandler(IO.removeCourse.input, IO.removeCourse.output, removeCourseFn));

export default {
	router,
	registry,
	authRegistry,
	paths: {},
}
