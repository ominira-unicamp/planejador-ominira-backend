import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';
import { CourseBlockType, CourseRequirementType } from '../../../prisma/generated/client.js';

extendZodWithOpenApi(z);

const courseRequirementSchema = z.object({
	id: z.number().int(),
	type: z.enum(CourseRequirementType),
	courseId: z.number().int().nullable(),
	courseCode: z.string().nullable(),
	courseName: z.string().nullable(),
	prefixId: z.number().int().nullable(),
	prefix: z.string().nullable(),
});

const electiveBlockSchema = z.object({
	credits: z.number().int(),
	courses: z.array(courseRequirementSchema),
});

const courseBlockSetSchema = z.object({
	mandatory: z.array(courseRequirementSchema),
	electives: z.array(electiveBlockSchema),
});
export const prismaBlockSetSelection = {
	include: {
		courseRequirements: {
			include: {
				course: {
					select: {
						id: true,
						code: true,
						name: true,
					}
				},
				prefix: {
					select: {
						id: true,
						prefix: true,
					}
				}
			}
		}
	}
} as const satisfies MyPrisma.CourseBlockDefaultArgs;

export const prismaCatalogProgramFieldSelection = {
	include: {
		catalog: {
			select: {
				id: true,
				year: true,
			}
		},
		program: {
			select: {
				id: true,
				code: true,
				name: true,
			}
		},
		catalogSpecializations: {
			include: {
				specialization: {
					select: {
						id: true,
						code: true,
						name: true,
					}
				},
				courseBlocks: prismaBlockSetSelection
			}
		},
		catalogLanguages: {
			include: {
				language: {
					select: {
						id: true,
						name: true,
					}
				},
				courseBlocks: prismaBlockSetSelection
			}
		},
		courseBlocks: prismaBlockSetSelection
	},
} as const satisfies MyPrisma.CatalogProgramDefaultArgs;

type PrismaCatalogProgramPayload = MyPrisma.CatalogProgramGetPayload<typeof prismaCatalogProgramFieldSelection>;

function relatedPathsForCatalogProgram(catalogProgramId: number, catalogId: number, programId: number) {
	return {
		self: resourcesPaths.catalogProgram.entity(catalogProgramId),
		catalog: resourcesPaths.catalog.entity(catalogId),
		program: resourcesPaths.program.entity(programId),
	}
}

function transformCourseBlocks(courseBlocks: PrismaCatalogProgramPayload['courseBlocks']): z.infer<typeof courseBlockSetSchema> {
	const mandatory: z.infer<typeof courseRequirementSchema>[] = [];
	const electives: z.infer<typeof electiveBlockSchema>[] = [];

	const mandatoryBlocks = courseBlocks.filter(block => block.type === CourseBlockType.mandatory);
	const electiveBlocks = courseBlocks.filter(block => block.type === CourseBlockType.elective);

	for (const block of mandatoryBlocks) {
		for (const req of block.courseRequirements) {
			mandatory.push({
				id: req.id,
				type: req.type,
				courseId: req.courseId,
				courseCode: req.course?.code ?? null,
				courseName: req.course?.name ?? null,
				prefixId: req.prefixId,
				prefix: req.prefix?.prefix ?? null,
			});
		}
	}

	for (const block of electiveBlocks) {
		const courses = block.courseRequirements.map(req => ({
			id: req.id,
			type: req.type,
			courseId: req.courseId,
			courseCode: req.course?.code ?? null,
			courseName: req.course?.name ?? null,
			prefixId: req.prefixId,
			prefix: req.prefix?.prefix ?? null,
		}));

		electives.push({
			credits: block.credits ?? 0,
			courses,
		});
	}

	return { mandatory, electives };
}

function buildCatalogProgramEntity(catalogProgram: PrismaCatalogProgramPayload): z.infer<typeof catalogProgramEntity> {
	const { catalogSpecializations, catalogLanguages, courseBlocks, ...rest } = catalogProgram;

	const base = transformCourseBlocks(courseBlocks);

	const modalities = catalogSpecializations.map(spec => ({
		specializationId: spec.specializationId,
		code: spec.specialization.code,
		name: spec.specialization.name,
		blocks: transformCourseBlocks(spec.courseBlocks),
	}));

	const languages = catalogLanguages.map(lang => ({
		languageId: lang.languageId,
		name: lang.language.name,
		blocks: transformCourseBlocks(lang.courseBlocks),
	}));

	return {
		...rest,
		title: catalogProgram.program.name,
		catalogYear: catalogProgram.catalog.year,
		programCode: catalogProgram.program.code,
		programName: catalogProgram.program.name,
		base,
		modalities,
		languages,
		_paths: relatedPathsForCatalogProgram(rest.id, rest.catalogId, rest.programId)
	};
}

const catalogProgramEntity = z.object({
	id: z.number().int(),
	catalogId: z.number().int(),
	programId: z.number().int(),
	title: z.string(),
	catalogYear: z.number().int(),
	programCode: z.number().int(),
	programName: z.string(),
	base: courseBlockSetSchema,
	modalities: z.array(z.object({
		specializationId: z.number().int(),
		code: z.string(),
		name: z.string(),
		blocks: courseBlockSetSchema,
	})),
	languages: z.array(z.object({
		languageId: z.number().int(),
		name: z.string(),
		blocks: courseBlockSetSchema,
	})),
	_paths: z.object({
		self: z.string(),
		catalog: z.string(),
		program: z.string(),
	})
}).strict().openapi('CatalogProgramEntity');

export default {
	schema: catalogProgramEntity,
	build: buildCatalogProgramEntity,
	prismaSelection: prismaCatalogProgramFieldSelection,
	courseRequirementSchema,
	creditSumSchema: electiveBlockSchema,
	courseBlockSetSchema,
}
