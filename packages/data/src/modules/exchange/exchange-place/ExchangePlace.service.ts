import { resourcesPaths } from "#/Controllers.js";
import type {
    ExchangePlaceFilter,
    ExchangePlaceFilterName
} from "#/modules/exchange/exchange-place/ExchangePlace.contract.js";
import IO from "#/modules/exchange/exchange-place/ExchangePlace.contract.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type ExchangePlace = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const exchangePlaceWhere = prismaWhereFor<MyPrisma.ExchangePlaceWhereInput>();
const exchangePlaceWhereDefinitions = {
    id: exchangePlaceWhere.numberAt("id"),
    name: exchangePlaceWhere.containsAt("name")
} satisfies Record<
    ExchangePlaceFilterName,
    FilterWhereBuilder<MyPrisma.ExchangePlaceWhereInput>
>;
export function exchangePlaceFilterWhere(
    filter: ExchangePlaceFilter | undefined
): MyPrisma.ExchangePlaceWhereInput[] {
    return compileFilterWhere(
        filter,
        exchangePlaceWhereDefinitions,
        "exchange place"
    );
}

export type ExchangePlaceService = {
    list(query: Query): Promise<ExchangePlace[]>;
};

export function createExchangePlaceService({
    prisma
}: {
    prisma: PrismaClient;
}): ExchangePlaceService {
    return {
        async list(query) {
            const filterWhere = exchangePlaceFilterWhere(query.filter);
            const places = await prisma.exchangePlace.findMany({
                where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                orderBy: [{ name: "asc" }, { id: "asc" }]
            });
            return places.map((place) => ({
                id: place.id,
                name: place.name,
                _paths: {
                    notices: resourcesPaths.exchangeNotice.list({
                        placeId: place.id
                    })
                }
            }));
        }
    };
}
