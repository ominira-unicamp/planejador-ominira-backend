import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../../PrismaClient.js'
import { resourcesPaths } from '../../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaCurriculumFieldSelection = {
	include: {
		CurriculumCourses: {
			select: {
				courseId: true,
				semester: true,
				course: {
					select: {
						code: true,
						name: true,
					}
				}
			}
		},
	},
} as const satisfies MyPrisma.CurriculumDefaultArgs;

type PrismaCurriculumPayload = MyPrisma.CurriculumGetPayload<typeof prismaCurriculumFieldSelection>;

function relatedPathsForCurriculum(curriculumId: number, studentId: number) {
	return {
		self: resourcesPaths.curriculum.entity(studentId, curriculumId),
		student: resourcesPaths.student.entity(studentId),
	}
}

function buildCurriculumEntity(curriculum: PrismaCurriculumPayload): z.infer<typeof curriculumEntity> {
	const { CurriculumCourses, ...rest } = curriculum;
	return {
		...rest,
		courses: CurriculumCourses.map(({ courseId, course, semester }) => ({
			courseId: courseId,
			semester,
			name: course.name,
			code: course.code,
		})),
		_paths: relatedPathsForCurriculum(curriculum.id, curriculum.studentId)
	};
}

const curriculumEntity = z.object({
	id: z.number().int(),
	studentId: z.number().int(),
	courses: z.array(z.object({
		courseId: z.number().int(),
		semester: z.number().int().nullable(),
		name: z.string(),
		code: z.string(),
	})),
	_paths: z.object({
		student: z.string(),
	})
}).strict().openapi('CurriculumEntity');

export default {
	schema: curriculumEntity,
	build: buildCurriculumEntity,
	prismaSelection: prismaCurriculumFieldSelection
}
