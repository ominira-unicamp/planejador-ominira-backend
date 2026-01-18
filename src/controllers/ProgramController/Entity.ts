import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma, selectIdCode } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaProgramFieldSelection = {
	include: {
		institute: selectIdCode,
		_count: {
			select: {
				catalogPrograms: true,
				students: true,
			}
		}
	},
} as const satisfies MyPrisma.ProgramDefaultArgs;

type PrismaProgramPayload = MyPrisma.ProgramGetPayload<typeof prismaProgramFieldSelection>;

function relatedPathsForProgram(program: PrismaProgramPayload) {
	return {
		self: resourcesPaths.program.entity(program.id),
		institute: resourcesPaths.institute.entity(program.institute.id),
	}
}

function buildProgramEntity(program: PrismaProgramPayload): z.infer<typeof schema> {
	const { institute, _count, ...rest } = program;
	return {
		...rest,
		institute,
		catalogProgramsCount: _count.catalogPrograms,
		studentsCount: _count.students,
		_paths: relatedPathsForProgram(program),
	};
}

const schema = z.object({
	id: z.number().int(),
	code: z.number().int(),
	name: z.string(),
	instituteId: z.number().int(),
	institute: z.object({
		id: z.number().int(),
		code: z.string(),
	}),
	catalogProgramsCount: z.number().int(),
	studentsCount: z.number().int(),
	_paths: z.object({
		self: z.string(),
		institute: z.string(),
	}),
}).openapi('Program');

const programEntity = {
	build: buildProgramEntity,
	prismaSelection: prismaProgramFieldSelection,
	schema: schema
}

export default programEntity;
