import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/catalog/contracts/CatalogInterface.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { MyPrisma } from "@pomi/db";
import z from "zod";

extendZodWithOpenApi(z);

export const prismaCatalogFieldSelection = {
    include: {
        programs: {
            select: {
                id: true,
                programId: true
            }
        },
        _count: {
            select: {
                students: true,
                programs: true
            }
        }
    }
} as const satisfies MyPrisma.CatalogDefaultArgs;

type PrismaCatalogPayload = MyPrisma.CatalogGetPayload<
    typeof prismaCatalogFieldSelection
>;

function relatedPathsForCatalog(catalog: PrismaCatalogPayload) {
    return {
        self: resourcesPaths.catalog.entity(catalog.id)
    };
}

function buildCatalogEntity(
    catalog: PrismaCatalogPayload
): z.infer<typeof IO.schemas.catalogEntitySchema> {
    const { programs, _count, ...rest } = catalog;
    return {
        ...rest,
        programsCount: _count.programs,
        studentsCount: _count.students,
        programIds: programs.map((p) => p.programId),
        links: relatedPathsForCatalog(catalog)
    };
}

const catalogEntity = {
    build: buildCatalogEntity,
    prismaSelection: prismaCatalogFieldSelection
};

export default catalogEntity;
