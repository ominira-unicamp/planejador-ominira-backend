import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("exchange-notices")];
const specsBuilder = new SpecBuilder(basePath, ["exchange-notices"], "id");
const dateInput = z.iso.date().pipe(z.coerce.date());

const placeSchema = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        _paths: z.object({ notices: z.string() }).strict()
    })
    .strict()
    .openapi("ExchangePlace");

const fileSchema = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        url: z.string().url().nullable()
    })
    .strict()
    .openapi("ExchangeNoticeFile");

const schema = z
    .object({
        id: z.number().int().positive(),
        number: z.string().nullable(),
        issuer: z.string().nullable(),
        title: z.string().nullable(),
        place: placeSchema.nullable(),
        registrationOriginalText: z.string().nullable(),
        registrationStart: z.iso.date().nullable(),
        registrationEnd: z.iso.date().nullable(),
        files: z.array(fileSchema),
        _paths: z.object({ self: z.string() }).strict()
    })
    .strict()
    .openapi("ExchangeNotice");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Exchange notice retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const listQuery = z
    .object({
        placeId: z.coerce.number().int().positive().optional(),
        placeName: z.string().trim().min(1).optional(),
        registrationStartAfter: dateInput.optional(),
        registrationStartBefore: dateInput.optional(),
        registrationEndAfter: dateInput.optional(),
        registrationEndBefore: dateInput.optional()
    })
    .refine(
        ({ registrationStartAfter, registrationStartBefore }) =>
            !registrationStartAfter ||
            !registrationStartBefore ||
            registrationStartAfter <= registrationStartBefore,
        {
            path: ["registrationStartBefore"],
            message:
                "registrationStartBefore must be greater than or equal to registrationStartAfter"
        }
    )
    .refine(
        ({ registrationEndAfter, registrationEndBefore }) =>
            !registrationEndAfter ||
            !registrationEndBefore ||
            registrationEndAfter <= registrationEndBefore,
        {
            path: ["registrationEndBefore"],
            message:
                "registrationEndBefore must be greater than or equal to registrationEndAfter"
        }
    );

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({ query: listQuery }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of exchange notices retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

export default { schema, get, list };
