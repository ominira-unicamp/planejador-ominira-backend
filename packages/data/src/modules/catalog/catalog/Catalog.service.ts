import IO from "#/modules/catalog/catalog/Catalog.contract.js";
import catalogEntity from "#/modules/catalog/catalog/Catalog.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Catalog = z.infer<typeof IO.schemas.catalogEntitySchema>;
type Query = z.infer<typeof IO.list.request>["query"];
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
            return (
                await prisma.catalog.findMany({
                    ...catalogEntity.prismaSelection,
                    where: query.year ? { year: query.year } : {},
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
