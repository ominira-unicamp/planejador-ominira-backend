import IO from "#/modules/exchange/exchange-notice/ExchangeNotice.contract.js";
import exchangeNoticeEntity from "#/modules/exchange/exchange-notice/ExchangeNotice.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { Prisma, PrismaClient } from "@pomi/db";
import z from "zod";

type ExchangeNotice = z.infer<typeof IO.schema>;
type ListQuery = z.infer<typeof IO.list.request>["query"];

export type ExchangeNoticeService = {
    list(query: ListQuery): Promise<ExchangeNotice[]>;
    getById(
        id: number
    ): Promise<
        Result<
            ExchangeNotice,
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
};

function dateRange(
    after: Date | undefined,
    before: Date | undefined
): Prisma.DateTimeNullableFilter | undefined {
    if (!after && !before) return undefined;
    return {
        ...(after ? { gte: after } : {}),
        ...(before ? { lte: before } : {})
    };
}

export function createExchangeNoticeService({
    prisma
}: {
    prisma: PrismaClient;
}): ExchangeNoticeService {
    return {
        async list(query) {
            const notices = await prisma.exchangeNotice.findMany({
                ...exchangeNoticeEntity.prismaSelection,
                where: {
                    ...(query.placeId ? { placeId: query.placeId } : {}),
                    ...(query.placeName
                        ? {
                              place: {
                                  name: {
                                      contains: query.placeName,
                                      mode: "insensitive"
                                  }
                              }
                          }
                        : {}),
                    ...(dateRange(
                        query.registrationStartAfter,
                        query.registrationStartBefore
                    )
                        ? {
                              registrationStart: dateRange(
                                  query.registrationStartAfter,
                                  query.registrationStartBefore
                              )
                          }
                        : {}),
                    ...(dateRange(
                        query.registrationEndAfter,
                        query.registrationEndBefore
                    )
                        ? {
                              registrationEnd: dateRange(
                                  query.registrationEndAfter,
                                  query.registrationEndBefore
                              )
                          }
                        : {})
                },
                orderBy: [
                    { registrationEnd: { sort: "desc", nulls: "last" } },
                    { registrationStart: { sort: "desc", nulls: "last" } },
                    { id: "desc" }
                ]
            });
            return notices.map(exchangeNoticeEntity.build);
        },
        async getById(id) {
            const notice = await prisma.exchangeNotice.findUnique({
                ...exchangeNoticeEntity.prismaSelection,
                where: { id }
            });
            return notice
                ? ok(exchangeNoticeEntity.build(notice))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Exchange notice not found"
                      })
                  );
        }
    };
}
