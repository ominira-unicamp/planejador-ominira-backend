import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../../PrismaClient.js'

extendZodWithOpenApi(z);

export const prismaCurriculumCourseFieldSelection = {
	include: {
		course: {
			select: {
				code: true,
				name: true,
			}
		},
	},
} as const satisfies MyPrisma.CurriculumCourseDefaultArgs;

type PrismaCurriculumCoursePayload = MyPrisma.CurriculumCourseGetPayload<typeof prismaCurriculumCourseFieldSelection>;

function buildCurriculumCourseEntity(curriculumCourse: PrismaCurriculumCoursePayload): z.infer<typeof curriculumCourseEntity> {
	const { course, ...rest } = curriculumCourse;
	return {
		...rest,
		courseName: course.name,
		courseCode: course.code,
	};
}

const curriculumCourseEntity = z.object({
	curriculumId: z.number().int(),
	courseId: z.number().int(),
	semester: z.number().int().nullable(),
	courseName: z.string(),
	courseCode: z.string(),
}).strict().openapi('CurriculumCourseEntity');

export default {
	schema: curriculumCourseEntity,
	build: buildCurriculumCourseEntity,
	prismaSelection: prismaCurriculumCourseFieldSelection
}
