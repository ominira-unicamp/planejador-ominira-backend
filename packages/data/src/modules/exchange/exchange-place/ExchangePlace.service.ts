import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/exchange/exchange-place/ExchangePlace.contract.js";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type ExchangePlace = z.infer<typeof IO.schema>;

export type ExchangePlaceService = {
    list(): Promise<ExchangePlace[]>;
};

export function createExchangePlaceService({
    prisma
}: {
    prisma: PrismaClient;
}): ExchangePlaceService {
    return {
        async list() {
            const places = await prisma.exchangePlace.findMany({
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
