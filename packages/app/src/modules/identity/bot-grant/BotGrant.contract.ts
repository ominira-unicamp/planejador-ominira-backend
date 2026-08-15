import { type IO, OutputBuilder } from "#/Contract.js";
import {
    policies,
    StudentCapabilities,
    type StudentCapability
} from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, ResourceNotFoundProblemSchema } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const capabilities = Object.values(StudentCapabilities) as [
    StudentCapability,
    ...StudentCapability[]
];
const entity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        botAuthUserId: z.number().int(),
        capability: z.enum(capabilities),
        createdAt: z.coerce.date(),
        revokedAt: z.coerce.date().nullable(),
        botAuthUser: z.object({
            id: z.number().int(),
            displayName: z.string().nullable()
        })
    })
    .strict()
    .openapi("BotGrantEntity");

const bot = z
    .object({ id: z.number().int(), displayName: z.string().nullable() })
    .strict()
    .openapi("BotIdentityEntity");
const path = z.object({
    botAuthUserId: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const replaceBody = z
    .object({ capabilities: z.array(z.enum(capabilities)) })
    .strict()
    .openapi("ReplaceBotGrantBody");

const listBots = {
    meta: {
        method: "get" as const,
        path: [pathSeg.literal("bots")],
        tags: ["bot-grants"],
        authorization: policies.authenticated
    },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(bot), "Bots ativos recuperados")
        .build()
} satisfies IO;
const list = {
    meta: {
        method: "get" as const,
        path: [pathSeg.literal("me"), pathSeg.literal("bot-grants")],
        tags: ["bot-grants"],
        authorization: policies.authenticated
    },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(entity), "Permissões de bots recuperadas")
        .build()
} satisfies IO;
const replace = {
    meta: {
        method: "put" as const,
        path: [
            pathSeg.literal("me"),
            pathSeg.literal("bot-grants"),
            pathSeg.param("botAuthUserId")
        ],
        tags: ["bot-grants"],
        authorization: policies.authenticated
    },
    request: z.object({ path, body: replaceBody }),
    response: new OutputBuilder()
        .noContent()
        .problem(404, ResourceNotFoundProblemSchema, "Bot não encontrado")
        .build()
} satisfies IO;

export default {
    schemas: { entity, bot, replaceBody },
    listBots,
    list,
    replace
};
