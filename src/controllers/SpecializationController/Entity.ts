import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaSpecializationFieldSelection = {
	include: {
		_count: {
			select: {
				catalogSpecializations: true,
				students: true,
			}
		}
	},
} as const satisfies MyPrisma.SpecializationDefaultArgs;

type PrismaSpecializationPayload = MyPrisma.SpecializationGetPayload<typeof prismaSpecializationFieldSelection>;

function relatedPathsForSpecialization(specialization: PrismaSpecializationPayload) {
	return {
		self: resourcesPaths.specialization.entity(specialization.id),
	}
}

function buildSpecializationEntity(specialization: PrismaSpecializationPayload): z.infer<typeof schema> {
	const { _count, ...rest } = specialization;
	return {
		...rest,
		catalogSpecializationsCount: _count.catalogSpecializations,
		studentsCount: _count.students,
		_paths: relatedPathsForSpecialization(specialization),
	};
}

const schema = z.object({
	id: z.number().int(),
	code: z.string(),
	name: z.string(),
	catalogSpecializationsCount: z.number().int(),
	studentsCount: z.number().int(),
	_paths: z.object({
		self: z.string(),
	}),
}).openapi('Specialization');

const specializationEntity = {
	build: buildSpecializationEntity,
	prismaSelection: prismaSpecializationFieldSelection,
	schema: schema
}

export default specializationEntity;
