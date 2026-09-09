import type {
    RoomFilter,
    RoomFilterName
} from "#/modules/academic/room/Room.contract.js";
import IO from "#/modules/academic/room/Room.contract.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type Room = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const roomWhere = prismaWhereFor<MyPrisma.RoomWhereInput>();
const roomWhereDefinitions = {
    id: roomWhere.numberAt("id"),
    code: roomWhere.stringAt("code")
} satisfies Record<RoomFilterName, FilterWhereBuilder<MyPrisma.RoomWhereInput>>;
export function roomFilterWhere(
    filter: RoomFilter | undefined
): MyPrisma.RoomWhereInput[] {
    return compileFilterWhere(filter, roomWhereDefinitions, "room");
}

export type RoomService = {
    list(query: Query): Promise<Room[]>;
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
        async list(query) {
            const filterWhere = roomFilterWhere(query.filter);
            return (
                await prisma.room.findMany({
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {}
                })
            ).map((room) => ({
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
