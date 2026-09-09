import type {
    CatalogProgramFilter,
    CatalogProgramFilterName
} from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import IO from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import catalogProgramEntity from "#/modules/catalog/catalog-program/CatalogProgram.entity.js";
import { catalogProgramNotFoundProblem } from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogProgramEntity = z.infer<typeof IO.schemas.catalogProgramEntity>;
type CatalogProgramListInput = z.infer<typeof IO.list.request>["query"];

const catalogProgramWhere = prismaWhereFor<MyPrisma.CatalogProgramWhereInput>();
const catalogProgramWhereDefinitions = {
    catalogId: catalogProgramWhere.numberAt("catalogId"),
    catalogYear: catalogProgramWhere.numberAt("catalog.year"),
    programId: catalogProgramWhere.numberAt("programId"),
    programCode: catalogProgramWhere.numberAt("program.code")
} satisfies Record<
    CatalogProgramFilterName,
    FilterWhereBuilder<MyPrisma.CatalogProgramWhereInput>
>;

export function catalogProgramFilterWhere(
    filter: CatalogProgramFilter | undefined
): MyPrisma.CatalogProgramWhereInput[] {
    return compileFilterWhere<MyPrisma.CatalogProgramWhereInput>(
        filter,
        catalogProgramWhereDefinitions,
        "catalog program"
    );
}

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
        async list({ filter }) {
            const filterWhere = catalogProgramFilterWhere(filter);
            const where: MyPrisma.CatalogProgramWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
            const catalogPrograms = await prisma.catalogProgram.findMany({
                ...catalogProgramEntity.prismaSelection,
                where
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
