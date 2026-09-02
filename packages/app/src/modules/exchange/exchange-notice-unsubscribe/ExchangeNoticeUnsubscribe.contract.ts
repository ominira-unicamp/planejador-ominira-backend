import { type IO, OutputBuilder } from "#/Contract.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const unsubscribe = {
    meta: {
        method: "post" as const,
        path: [
            pathSeg.literal("exchange-notice-subscriptions"),
            pathSeg.literal("unsubscribe")
        ],
        tags: ["exchange-notice-subscriptions"],
        authorization: policies.public
    },
    request: z.object({ query: z.object({ token: z.string().min(1) }) }),
    response: new OutputBuilder()
        .ok(
            z.object({ enabled: z.literal(false) }).strict(),
            "Notificações desativadas"
        )
        .build()
} satisfies IO;

export default { unsubscribe };
