import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma, selectIdCode, selectIdName } from '../../../PrismaClient.js'
import { resourcesPaths } from '../../../Controllers.js';
import classEntity from '../../ClassController/Entity.js';
extendZodWithOpenApi(z);

export const prismaPeriodPlanningFieldSelection = {
	include: {
		studyPeriod: selectIdCode,
		classes: {
			include: {
				professors: selectIdName,
				studyPeriod: selectIdCode,
				classSchedules: {
					select: {
						id: true,
						dayOfWeek: true,
						start: true,
						end: true,
						room: selectIdCode,
					},
				},
				course: {
					select: {
						id: true,
						code: true,
						institute: selectIdCode,
					}
				},
			}
		},
	},
} as const satisfies MyPrisma.PeriodPlanningDefaultArgs;

type PrismaPeriodPlanningPayload = MyPrisma.PeriodPlanningGetPayload<typeof prismaPeriodPlanningFieldSelection>;

function relatedPathsForPeriodPlanning(
	periodPlanning: PrismaPeriodPlanningPayload
) {
	return {
		self: resourcesPaths.periodPlan.entity(periodPlanning.studentId, periodPlanning.id),
		student: resourcesPaths.student.entity(periodPlanning.studentId),
		studyPeriod: resourcesPaths.studyPeriod.entity(periodPlanning.studyPeriod.id),
	}
}

function buildPeriodPlanningEntity(periodPlanning: PrismaPeriodPlanningPayload): z.infer<typeof periodPlanningEntity> {
	const { studyPeriod, classes, ...rest } = periodPlanning;
	return {
		...rest,
		studyPeriodId: studyPeriod.id,
		studyPeriodCode: studyPeriod.code,
		classes: classes.map((c) => {
			const { professors, ...classRest } = c;
			return {
				...classRest,
				professors: professors.map((p) => ({
					id: p.id,
					name: p.name,
				})),
				classSchedules: c.classSchedules.map((cs) => ({
					id: cs.id,
					dayOfWeek: cs.dayOfWeek,
					start: cs.start,
					end: cs.end,
					roomId: cs.room.id,
					roomCode: cs.room.code,
				})),
			};
		}),
		_paths: relatedPathsForPeriodPlanning(periodPlanning)
	};
}

const periodPlanningEntity = z.object({
	id: z.number().int(),
	studentId: z.number().int(),
	studyPeriodId: z.number().int(),
	studyPeriodCode: z.string(),
	classes: z.array(z.object({
		id: z.number().int(),
		code: z.string(),
		reservations: z.array(z.number().int()),
		courseId: z.number().int(),
		professors: z.array(z.object({
			id: z.number().int(),
			name: z.string(),
		}).strict()),
		classSchedules: z.array(z.object({
			id: z.number().int(),
			dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
			start: z.string(),
			end: z.string(),
			roomId: z.number().int(),
			roomCode: z.string()
		}).strict()),
	}).strict()),
	_paths: z.object({
		self: z.string(),
		student: z.string(),
		studyPeriod: z.string(),
	}).strict(),
}).strict().openapi('PeriodPlanningEntity');

export default {
	schema: periodPlanningEntity,
	build: buildPeriodPlanningEntity,
	prismaSelection: prismaPeriodPlanningFieldSelection
}
