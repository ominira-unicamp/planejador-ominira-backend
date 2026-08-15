import IO from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import catalogProgramEntity from "#/modules/catalog/catalog-program/CatalogProgram.entity.js";
import { catalogProgramNotFoundProblem } from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogProgramEntity = z.infer<typeof IO.schemas.catalogProgramEntity>;

export type CatalogProgramListInput = {
    catalogId?: number;
    programId?: number;
    programCode?: number;
};

export type CatalogProgramService = {
    list(input: CatalogProgramListInput): Promise<CatalogProgramEntity[]>;
    getById(
        id: number
    ): Promise<
        Result<
            CatalogProgramEntity,
            ReturnType<typeof catalogProgramNotFoundProblem>
        >
    >;
};

export function createCatalogProgramService({
    prisma
}: {
    prisma: PrismaClient;
}): CatalogProgramService {
    return {
        async list({ catalogId, programId, programCode }) {
            const catalogPrograms = await prisma.catalogProgram.findMany({
                ...catalogProgramEntity.prismaSelection,
                where: {
                    ...(catalogId ? { catalogId } : {}),
                    ...(programId || programCode
                        ? {
                              program: {
                                  ...(programId ? { id: programId } : {}),
                                  ...(programCode ? { code: programCode } : {})
                              }
                          }
                        : {})
                }
            });
            return catalogPrograms.map(catalogProgramEntity.build);
        },
        async getById(id) {
            const catalogProgram = await prisma.catalogProgram.findUnique({
                ...catalogProgramEntity.prismaSelection,
                where: { id }
            });
            return catalogProgram
                ? ok(catalogProgramEntity.build(catalogProgram))
                : err(catalogProgramNotFoundProblem());
        }
    };
}
