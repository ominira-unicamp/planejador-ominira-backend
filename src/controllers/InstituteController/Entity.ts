import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

type PrismaInstitutePayload = MyPrisma.InstituteGetPayload<{}>;

function relatedPathsForInstitute(instituteId: number) {
	return {
		classes: resourcesPaths.class.list({
			instituteId: instituteId
		}),
		courses: resourcesPaths.course.list({ instituteId: instituteId })
	}
}

function buildInstituteEntity(institute: PrismaInstitutePayload): z.infer<typeof instituteEntity> {
	return {
		...institute,
		_paths: relatedPathsForInstitute(institute.id)
	};
}

const instituteEntity = z.object({
	id: z.number().int(),
	code: z.string(),
	_paths: z.object({
		classes: z.string(),
		courses: z.string(),
	}).strict()
}).strict().openapi('InstituteEntity');

export default {
	schema: instituteEntity,
	build: buildInstituteEntity
}
