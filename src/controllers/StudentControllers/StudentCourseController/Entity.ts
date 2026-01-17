import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma, selectIdCode, selectIdName } from '../../../PrismaClient.js'
import { resourcesPaths } from '../../../Controllers.js';
import { StudentCourseStatus } from '../../../../prisma/generated/client.js';

extendZodWithOpenApi(z);

export const prismaStudentCourseFieldSelection = {
	include: {
		course: {
			select: {
				id: true,
				code: true,
				name: true,
				credits: true,
				institute: selectIdCode,
			}
		},
	},
} as const satisfies MyPrisma.StudentCourseDefaultArgs;

type PrismaStudentCoursePayload = MyPrisma.StudentCourseGetPayload<typeof prismaStudentCourseFieldSelection>;

function relatedPathsForStudentCourse(
	studentCourse: PrismaStudentCoursePayload
) {
	return {
		self: resourcesPaths.studentCourse.entity(studentCourse.studentId, studentCourse.courseId),
		student: resourcesPaths.student.entity(studentCourse.studentId),
		course: resourcesPaths.course.entity(studentCourse.course.id),
	}
}

function buildStudentCourseEntity(studentCourse: PrismaStudentCoursePayload): z.infer<typeof schema> {
	const { course, ...rest } = studentCourse;
	return {
		...rest,
		course: {
			id: course.id,
			code: course.code,
			name: course.name,
			credits: course.credits,
			institute: course.institute,
		},
		_paths: relatedPathsForStudentCourse(studentCourse),
	};
}
const res = Object.keys(StudentCourseStatus) as [keyof typeof StudentCourseStatus];
export const statusSchema = z.enum(res);
const schema = z.object({
	studentId: z.number().int(),
	courseId: z.number().int(),
	status: statusSchema,
	course: z.object({
		id: z.number().int(),
		code: z.string(),
		name: z.string(),
		credits: z.number().int(),
		institute: z.object({
			id: z.number().int(),
			code: z.string(),
		}),
	}),
	_paths: z.object({
		self: z.string(),
		student: z.string(),
		course: z.string(),
	}),
}).openapi('StudentCourse');
const studentCourseEntity = {
	build: buildStudentCourseEntity,
	prismaSelection: prismaStudentCourseFieldSelection,
	schema: schema
}

export default studentCourseEntity;
