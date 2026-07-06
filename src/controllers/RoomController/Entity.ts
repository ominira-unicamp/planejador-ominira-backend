import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/RoomInterface.js";
import { MyPrisma, selectIdCode } from "../../PrismaClient.js";

const prismaFieldSelection = {
    include: {
        building: {
            include: {
                unit: selectIdCode
            }
        }
    }
} as const satisfies MyPrisma.RoomDefaultArgs;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaRoomPayload = MyPrisma.RoomGetPayload<typeof prismaFieldSelection>;

function buildRoomEntity(room: PrismaRoomPayload): z.infer<typeof IO.schema> {
    const { building, ...rest } = room;
    const entity = {
        ...rest,
        buildingCode: building?.code ?? null,
        unitId: building?.unitId ?? null,
        unitCode: building?.unit?.code ?? null,
        _paths: {
            entity: resourcesPaths.room.entity(room.id),
            building: building
                ? resourcesPaths.building.entity(building.id)
                : null,
            unit: building?.unit
                ? resourcesPaths.unit.entity(building.unit.id)
                : null
        }
    };
    return entity;
}

export default {
    selection: prismaFieldSelection,
    build: buildRoomEntity
};
