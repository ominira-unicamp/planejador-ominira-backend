import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma, selectIdCode } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaClassScheduleFieldSelection = {
	include: {
		room: selectIdCode,
		class: {
			select: {
				id: true,
				code: true,
				courseId: true,
				studyPeriodId: true,
				studyPeriod: selectIdCode,
				course: {
					select: {
						id: true,
						code: true,
						institute: selectIdCode,
					}
				}
			}
		},
	},
} as const satisfies MyPrisma.ClassScheduleDefaultArgs;

type PrismaClassSchedulePayload = MyPrisma.ClassScheduleGetPayload<typeof prismaClassScheduleFieldSelection>;

function relatedPathsForClassSchedule(
	classScheduleId: number,
	studyPeriodId: number,
	instituteId: number,
	courseId: number,
	classId: number,
) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
		institute: resourcesPaths.institute.entity(instituteId),
		course: resourcesPaths.course.entity(courseId),
		class: resourcesPaths.class.entity(classId),
		entity: `/class-schedules/${classScheduleId}`
	}
}

function buildClassScheduleEntity(classSchedule: PrismaClassSchedulePayload): z.infer<typeof classScheduleEntity> {
	const { room, class: classObj, ...rest } = classSchedule
	return {
		...rest,
		roomCode: room.code,
		classCode: classObj.code,
		classId: classObj.id,
		instituteId: classObj.course.institute.id,
		instituteCode: classObj.course.institute.code,
		courseId: classObj.course.id,
		courseCode: classObj.course.code,
		studyPeriodId: classObj.studyPeriod.id,
		studyPeriodCode: classObj.studyPeriod.code,
		_paths: relatedPathsForClassSchedule(
			classSchedule.id,
			classObj.studyPeriod.id,
			classObj.course.institute.id,
			classObj.course.id,
			classObj.id
		)
	}
}

const classScheduleEntity = z.object({
	id: z.number().int(),
	dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
	start: z.string(),
	end: z.string(),
	roomId: z.number().int(),
	classId: z.number().int(),
	roomCode: z.string(),
	classCode: z.string(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	courseId: z.number().int(),
	courseCode: z.string(),
	studyPeriodId: z.number().int(),
	studyPeriodCode: z.string(),
	_paths: z.object({
		entity: z.string(),
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		class: z.string(),
	}).strict(),
}).strict().openapi('ClassScheduleEntity');

export default {
	schema: classScheduleEntity,
	build: buildClassScheduleEntity,
	prismaSelection: prismaClassScheduleFieldSelection
}
