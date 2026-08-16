import IO from "#/modules/academic/room/Room.contract.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Room = z.infer<typeof IO.schema>;

export type RoomService = {
    list(): Promise<Room[]>;
    getById(
        id: number
    ): Promise<Result<Room, ReturnType<typeof ResourceNotFoundProblem.create>>>;
};

export function createRoomService({
    prisma
}: {
    prisma: PrismaClient;
}): RoomService {
    return {
        async list() {
            return (await prisma.room.findMany()).map((room) => ({
                ...room,
                _paths: { entity: `/rooms/${room.id}` }
            }));
        },
        async getById(id) {
            const room = await prisma.room.findUnique({ where: { id } });
            return room
                ? ok({ ...room, _paths: { entity: `/rooms/${room.id}` } })
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Room not found"
                      })
                  );
        }
    };
}
