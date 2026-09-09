import type {
    UnitFilter,
    UnitFilterName
} from "#/modules/academic/unit/Unit.contract.js";
import IO from "#/modules/academic/unit/Unit.contract.js";
import unitEntity from "#/modules/academic/unit/Unit.entity.js";
import {
    compileFilterWhere,
    containsAt,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import type z from "zod";

type Unit = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const unitWhere = prismaWhereFor<MyPrisma.UnitWhereInput>();
const unitWhereDefinitions = {
    id: unitWhere.numberAt("id"),
    code: unitWhere.stringAt("code"),
    name: containsAt<MyPrisma.UnitWhereInput>("name")
} satisfies Record<UnitFilterName, FilterWhereBuilder<MyPrisma.UnitWhereInput>>;
export function unitFilterWhere(
    filter: UnitFilter | undefined
): MyPrisma.UnitWhereInput[] {
    return compileFilterWhere(filter, unitWhereDefinitions, "unit");
}
export type UnitService = {
    list(query: Query): Promise<Unit[]>;
    getById(
        id: number
    ): Promise<Result<Unit, ReturnType<typeof ResourceNotFoundProblem.create>>>;
};
export function createUnitService({
    prisma
}: {
    prisma: PrismaClient;
}): UnitService {
    return {
        async list(query) {
            const filterWhere = unitFilterWhere(query.filter);
            return (
                await prisma.unit.findMany({
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {}
                })
            ).map(unitEntity.build);
        },
        async getById(id) {
            const unit = await prisma.unit.findUnique({ where: { id } });
            return unit
                ? ok(unitEntity.build(unit))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Unit not found"
                      })
                  );
        }
    };
}
