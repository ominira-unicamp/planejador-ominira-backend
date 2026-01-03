import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import classScheduleEntity from './Entity.js';
import { getPaginatedSchema, paginationQuerySchema, PaginationQueryType } from '../../pagination.js';

extendZodWithOpenApi(z);

const daysOfWeekEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).openapi('DaysOfWeekEnum');

const classScheduleBase = z.object({
	id: z.number().int(),
	dayOfWeek: daysOfWeekEnum,
	start: z.string().min(1),
	end: z.string().min(1),
	roomId: z.number().int(),
	classId: z.number().int(),
}).strict();

const createClassScheduleBody = classScheduleBase.omit({ id: true }).openapi('CreateClassScheduleBody');

const patchClassScheduleBody = classScheduleBase
	.partial()
	.openapi('PatchClassScheduleBody');

const getClassSchedulesQuery = paginationQuerySchema.extend({
	studyPeriodId: z.coerce.number().int().optional(),
	studyPeriodCode: z.string().optional(),
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	roomId: z.coerce.number().int().optional(),
	roomCode: z.string().optional(),
	classId: z.coerce.number().int().optional(),
	dayOfWeek: daysOfWeekEnum.optional(),
}).openapi('GetClassSchedulesQuery');

const ClassSchedulePageSchema = getPaginatedSchema(classScheduleEntity.schema).openapi('PageClassSchedules');

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(classScheduleEntity.schema, "Class schedule retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({
		query: getClassSchedulesQuery,
	}),
	output: new OutputBuilder()
		.ok(ClassSchedulePageSchema, "List of class schedules retrieved successfully")
		.badRequest()
		.build(),
}

const create = {
	input: z.object({
		body: createClassScheduleBody,
	}),
	output: new OutputBuilder()
		.created(classScheduleEntity.schema, "Class schedule created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: patchClassScheduleBody,
	}),
	output: new OutputBuilder()
		.ok(classScheduleEntity.schema, "Class schedule updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Class schedule deleted successfully")
		.notFound()
		.build(),
}

export default {
	get,
	list,
	create,
	patch,
	remove
}

export type ListQueryParams = {
	instituteId?: number,
	courseId?: number,
	studyPeriodId?: number,
	classId?: number,
} & Partial<PaginationQueryType>;
