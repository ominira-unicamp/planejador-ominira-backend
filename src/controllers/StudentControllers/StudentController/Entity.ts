import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../../PrismaClient.js'
import { resourcesPaths } from '../../../Controllers.js';

extendZodWithOpenApi(z);

type PrismaStudentPayload = MyPrisma.StudentGetPayload<{}>;

function relatedPathsForStudent(studentId: number) {
	return {
		classes: resourcesPaths.class.list({
			studyPeriodId: studentId
		}),
		classSchedules: resourcesPaths.classSchedule.list({
			studyPeriodId: studentId
		}),
	}
}

function buildStudentEntity(student: PrismaStudentPayload): z.infer<typeof studentEntity> {
	return {
		...student,
		_paths: relatedPathsForStudent(student.id)
	};
}

const studentEntity = z.object({
	id: z.number().int(),
	ra: z.string(),
	name: z.string(),
	programId: z.number().int().nullable(),
	modalityId: z.number().int().nullable(),
	catalogId: z.number().int().nullable(),
	_paths: z.object({
		classes: z.string(),
		classSchedules: z.string(),
	})
}).strict().openapi('StudentEntity');

export default {
	schema: studentEntity,
	build: buildStudentEntity
}
