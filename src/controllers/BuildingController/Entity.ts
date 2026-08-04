import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/BuildingInterface.js";
import { MyPrisma, selectIdCode } from "../../PrismaClient.js";

export const prismaBuildingFieldSelection = {
    include: {
        unit: selectIdCode
    }
} as const satisfies MyPrisma.BuildingDefaultArgs;

type PrismaBuildingPayload = MyPrisma.BuildingGetPayload<
    typeof prismaBuildingFieldSelection
>;

function relatedPathsForBuilding(buildingPayload: PrismaBuildingPayload) {
    return {
        self: resourcesPaths.building.entity(buildingPayload.id),
        unit: buildingPayload.unitId
            ? resourcesPaths.unit.entity(buildingPayload.unitId)
            : null,
        rooms: resourcesPaths.room.list({
            buildingId: buildingPayload.id
        })
    };
}

function buildBuildingEntity(
    buildingData: PrismaBuildingPayload
): z.infer<typeof IO.schemas.buildingEntitySchema> {
    return {
        id: buildingData.id,
        code: buildingData.code,
        name: buildingData.name,
        latitude: buildingData.latitude,
        longitude: buildingData.longitude,
        unitId: buildingData.unitId,
        unitCode: buildingData.unit?.code ?? null,
        _paths: relatedPathsForBuilding(buildingData)
    };
}

export default {
    build: buildBuildingEntity,
    prismaSelection: prismaBuildingFieldSelection
};
