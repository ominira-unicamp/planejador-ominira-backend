import { type IO, OutputBuilder } from "#/Contract.js";
import { Capabilities, policies } from "#/auth.js";
import { AdminIdentityManagedByCliProblem } from "#/modules/identity/auth-user/AuthUser.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, ResourceNotFoundProblemSchema } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const capabilityValues = Object.values(Capabilities) as ["ACADEMIC_WRITE"];
const entity = z
    .object({
        id: z.number().int(),
        issuer: z.string(),
        subject: z.string(),
        email: z.string().nullable(),
        displayName: z.string().nullable(),
        status: z.enum(["ACTIVE", "DISABLED"]),
        roles: z.array(
            z.object({
                authUserId: z.number().int(),
                role: z.string()
            })
        ),
        capabilities: z.array(
            z.object({
                authUserId: z.number().int(),
                capability: z.string()
            })
        )
    })
    .strict()
    .openapi("AuthUserEntity");
const createBody = z
    .object({
        subject: z.string().min(1),
        displayName: z.string().min(1).max(200),
        capabilities: z.array(z.enum(capabilityValues)).default([])
    })
    .strict()
    .openapi("CreateBotAuthUserBody");
const patchBody = z
    .object({
        status: z.enum(["ACTIVE", "DISABLED"]).optional(),
        displayName: z.string().min(1).max(200).optional(),
        capabilities: z.array(z.enum(capabilityValues)).optional()
    })
    .strict()
    .openapi("PatchAuthUserBody");
const path = z.object({
    id: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const list = {
    meta: {
        method: "get" as const,
        path: [pathSeg.literal("admin"), pathSeg.literal("auth-users")],
        tags: ["auth-users"],
        authorization: policies.admin
    },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(entity), "Identidades recuperadas")
        .build()
} satisfies IO;
const create = {
    meta: {
        method: "post" as const,
        path: [pathSeg.literal("admin"), pathSeg.literal("auth-users")],
        tags: ["auth-users"],
        authorization: policies.admin
    },
    request: z.object({ body: createBody }),
    response: new OutputBuilder().created(entity, "Bot criado").build()
} satisfies IO;
const patch = {
    meta: {
        method: "patch" as const,
        path: [
            pathSeg.literal("admin"),
            pathSeg.literal("auth-users"),
            pathSeg.param("id")
        ],
        tags: ["auth-users"],
        authorization: policies.admin
    },
    request: z.object({ path, body: patchBody }),
    response: new OutputBuilder()
        .ok(entity, "Identidade atualizada")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Identidade não encontrada"
        )
        .problem(
            403,
            AdminIdentityManagedByCliProblem.schema,
            "Identidade administrada pela linha de comando"
        )
        .build()
} satisfies IO;
export default { schemas: { entity }, list, create, patch };
