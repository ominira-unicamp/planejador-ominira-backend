import z from "zod";
import IO from "../../Interfaces/RoomInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

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
