import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/exchange/exchange-notice/ExchangeNotice.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaExchangeNoticeSelection = {
    include: {
        place: true,
        files: { orderBy: [{ name: "asc" }, { id: "asc" }] }
    }
} as const satisfies MyPrisma.ExchangeNoticeDefaultArgs;

type PrismaExchangeNoticePayload = MyPrisma.ExchangeNoticeGetPayload<
    typeof prismaExchangeNoticeSelection
>;

function dateOrNull(value: Date | null) {
    return value?.toISOString().slice(0, 10) ?? null;
}

function buildExchangeNoticeEntity(
    notice: PrismaExchangeNoticePayload
): z.infer<typeof IO.schema> {
    return {
        id: notice.id,
        number: notice.number,
        issuer: notice.issuer,
        title: notice.title,
        place: notice.place
            ? {
                  id: notice.place.id,
                  name: notice.place.name,
                  _paths: {
                      notices: resourcesPaths.exchangeNotice.list({
                          placeId: notice.place.id
                      })
                  }
              }
            : null,
        registrationOriginalText: notice.registrationOriginalText,
        registrationStart: dateOrNull(notice.registrationStart),
        registrationEnd: dateOrNull(notice.registrationEnd),
        files: notice.files.map((file) => ({
            id: file.id,
            name: file.name,
            url: file.url
        })),
        _paths: { self: resourcesPaths.exchangeNotice.entity(notice.id) }
    };
}

export default {
    build: buildExchangeNoticeEntity,
    prismaSelection: prismaExchangeNoticeSelection
};
