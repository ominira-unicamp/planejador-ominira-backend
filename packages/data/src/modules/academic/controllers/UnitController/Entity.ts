import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/academic/contracts/UnitInterface.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaUnitPayload = MyPrisma.UnitGetPayload<{}>;

function relatedPathsForUnit(unitId: number) {
    return {
        classes: resourcesPaths.class.list({
            unitId: unitId
        }),
        courses: resourcesPaths.course.list({ unitId: unitId })
    };
}

function buildUnitEntity(unit: PrismaUnitPayload): z.infer<typeof IO.schema> {
    return {
        ...unit,
        _paths: relatedPathsForUnit(unit.id)
    };
}

export default {
    build: buildUnitEntity
};
