import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma, selectIdCode, selectIdName } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaClassFieldSelection = {
	include: {
		professors: selectIdName,
		studyPeriod: selectIdCode,
		course: {
			select: {
				id: true,
				code: true,
				institute: selectIdCode,
			}
		},
	}
} as const satisfies MyPrisma.ClassDefaultArgs;

type PrismaClassPayload = MyPrisma.ClassGetPayload<typeof prismaClassFieldSelection>;

function relatedPathsForClass(classPayload: PrismaClassPayload) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(classPayload.studyPeriod.id),
		institute: resourcesPaths.institute.entity(classPayload.course.institute.id),
		course: resourcesPaths.course.entity(classPayload.course.id),
		class: resourcesPaths.class.entity(classPayload.id),
		classSchedules: resourcesPaths.classSchedule.list({
			classId: classPayload.id,
		}),
		professors: resourcesPaths.professor.list({
			classId: classPayload.id,
		}),
	}
}

function buildClassEntity(classData: PrismaClassPayload): z.infer<typeof classEntity> {
	const { course, studyPeriod, ...rest } = classData;
	return {
		...rest,
		studyPeriodId: studyPeriod.id,
		studyPeriodCode: studyPeriod.code,
		courseId: course.id,
		courseCode: course.code,
		instituteId: course.institute.id,
		instituteCode: course.institute.code,
		professorIds: classData.professors.map((p) => p.id),
		_paths: relatedPathsForClass(classData),
	};
}

const classEntity = z.object({
	id: z.number().int(),
	code: z.string(),
	reservations: z.array(z.number().int()),
	courseId: z.number().int(),
	studyPeriodId: z.number().int(),
	professorIds: z.array(z.number().int()),
	studyPeriodCode: z.string(),
	courseCode: z.string(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	professors: z.array(z.object({
		id: z.number().int(),
		name: z.string(),
	}).strict()),
	_paths: z.object({
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		class: z.string(),
		classSchedules: z.string(),
		professors: z.string(),
	}).strict(),
}).strict().openapi('ClassEntity');

export default {
	schema: classEntity,
	build: buildClassEntity,
	prismaSelection: prismaClassFieldSelection
}
