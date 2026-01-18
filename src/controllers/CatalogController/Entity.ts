import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaCatalogFieldSelection = {
	include: {
		programs: {
			select: {
				id: true,
				programId: true,
			}
		},
		_count: {
			select: {
				students: true,
				programs: true,
			}
		}
	},
} as const satisfies MyPrisma.CatalogDefaultArgs;

type PrismaCatalogPayload = MyPrisma.CatalogGetPayload<typeof prismaCatalogFieldSelection>;

function relatedPathsForCatalog(
	catalog: PrismaCatalogPayload
) {
	return {
		self: resourcesPaths.catalog.entity(catalog.id),
	}
}

function buildCatalogEntity(catalog: PrismaCatalogPayload): z.infer<typeof schema> {
	const { programs, _count, ...rest } = catalog;
	return {
		...rest,
		programsCount: _count.programs,
		studentsCount: _count.students,
		programIds: programs.map(p => p.programId),
		links: relatedPathsForCatalog(catalog),
	};
}

const schema = z.object({
	id: z.number().int().openapi({ example: 1 }),
	year: z.number().int().openapi({ example: 2024 }),
	programsCount: z.number().int().openapi({ example: 5 }),
	studentsCount: z.number().int().openapi({ example: 150 }),
	programIds: z.array(z.number().int()).openapi({ example: [1, 2, 3] }),
	links: z.object({
		self: z.string().openapi({ example: '/catalogs/1' }),
	}),
}).openapi('Catalog');
const catalogEntity = {
	build: buildCatalogEntity,
	prismaSelection: prismaCatalogFieldSelection,
	schema: schema,
}

export default catalogEntity;
