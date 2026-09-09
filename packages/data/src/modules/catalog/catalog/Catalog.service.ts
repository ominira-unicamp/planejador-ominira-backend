import type {
    CatalogFilter,
    CatalogFilterName
} from "#/modules/catalog/catalog/Catalog.contract.js";
import IO from "#/modules/catalog/catalog/Catalog.contract.js";
import catalogEntity from "#/modules/catalog/catalog/Catalog.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type Catalog = z.infer<typeof IO.schemas.catalogEntitySchema>;
type Query = z.infer<typeof IO.list.request>["query"];

const catalogWhere = prismaWhereFor<MyPrisma.CatalogWhereInput>();
const catalogWhereDefinitions = {
    year: catalogWhere.numberAt("year")
} satisfies Record<
    CatalogFilterName,
    FilterWhereBuilder<MyPrisma.CatalogWhereInput>
>;

export function catalogFilterWhere(
    filter: CatalogFilter | undefined
): MyPrisma.CatalogWhereInput[] {
    return compileFilterWhere(filter, catalogWhereDefinitions, "catalog");
}
export type CatalogService = {
    list(query: Query): Promise<Catalog[]>;
    getById(
        id: number
    ): Promise<
        Result<Catalog, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createCatalogService({
    prisma
}: {
    prisma: PrismaClient;
}): CatalogService {
    return {
        async list(query) {
            const filterWhere = catalogFilterWhere(query.filter);
            return (
                await prisma.catalog.findMany({
                    ...catalogEntity.prismaSelection,
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                    orderBy: { year: "desc" }
                })
            ).map(catalogEntity.build);
        },
        async getById(id) {
            const catalog = await prisma.catalog.findUnique({
                ...catalogEntity.prismaSelection,
                where: { id }
            });
            return catalog
                ? ok(catalogEntity.build(catalog))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Catalog not found"
                      })
                  );
        }
    };
}
