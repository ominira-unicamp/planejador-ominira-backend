import IO from "#/modules/academic/unit/Unit.contract.js";
import unitEntity from "#/modules/academic/unit/Unit.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import type z from "zod";

type Unit = z.infer<typeof IO.schema>;
export type UnitService = {
    list(): Promise<Unit[]>;
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
        async list() {
            return (await prisma.unit.findMany()).map(unitEntity.build);
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
