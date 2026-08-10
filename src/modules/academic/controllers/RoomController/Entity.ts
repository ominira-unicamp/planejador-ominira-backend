import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/academic/contracts/RoomInterface.js";
import z from "zod";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaRoomPayload = MyPrisma.RoomGetPayload<{}>;

function buildRoomEntity(room: PrismaRoomPayload): z.infer<typeof IO.schema> {
    return {
        ...room,
        _paths: {
            entity: `/rooms/${room.id}`
        }
    };
}

export default {
    build: buildRoomEntity
};
