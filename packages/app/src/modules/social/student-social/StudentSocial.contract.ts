import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ResourceNotFoundProblemSchema,
    UniqueConstraintConflictProblemSchema
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const sidPath = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const publicIdPath = sidPath.extend({ publicId: z.string().uuid() });
const friendshipPath = sidPath.extend({
    id: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const academicReference = z
    .object({ code: z.union([z.string(), z.number()]), name: z.string() })
    .strict();
const person = z
    .object({
        publicId: z.string().uuid(),
        displayName: z.string(),
        bio: z.string().nullable(),
        program: academicReference.nullable(),
        specialization: academicReference.nullable(),
        entryYear: z.number().int().nullable(),
        _paths: z.object({ self: z.string() }).strict()
    })
    .strict()
    .openapi("StudentPublicPerson");
const ownProfile = person
    .extend({
        enabled: z.boolean(),
        showProgram: z.boolean(),
        showSpecialization: z.boolean(),
        showEntryYear: z.boolean()
    })
    .strict()
    .openapi("StudentPublicProfile");
const friendship = z
    .object({
        id: z.number().int(),
        status: z.enum(["PENDING", "ACCEPTED"]),
        direction: z.enum(["INCOMING", "OUTGOING", "NONE"]),
        friend: person,
        createdAt: z.string().datetime(),
        acceptedAt: z.string().datetime().nullable(),
        _paths: z.object({ self: z.string(), friend: z.string() }).strict()
    })
    .strict()
    .openapi("StudentFriendship");
const profileBody = z
    .object({
        enabled: z.boolean().optional(),
        displayName: z.string().trim().min(1).max(80).nullable().optional(),
        bio: z.string().trim().max(280).nullable().optional(),
        showProgram: z.boolean().optional(),
        showSpecialization: z.boolean().optional(),
        showEntryYear: z.boolean().optional()
    })
    .strict();
const profilePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("public-profile")
];
const peoplePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("people")
];
const friendshipsPath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("friendships")
];
const read = policies.studentAccess("sid", StudentCapabilities.SOCIAL_READ);
const write = policies.studentAccess("sid", StudentCapabilities.SOCIAL_WRITE);

const getProfile = {
    meta: {
        method: "get" as const,
        path: profilePath,
        tags: ["student-social"],
        authorization: read
    },
    request: z.object({ path: sidPath }),
    response: new OutputBuilder()
        .ok(ownProfile, "Perfil público recuperado")
        .problem(404, ResourceNotFoundProblemSchema, "Aluno não encontrado")
        .build()
} satisfies IO;
const updateProfile = {
    meta: {
        method: "patch" as const,
        path: profilePath,
        tags: ["student-social"],
        authorization: write
    },
    request: z.object({ path: sidPath, body: profileBody }),
    response: new OutputBuilder()
        .ok(ownProfile, "Perfil público atualizado")
        .problem(404, ResourceNotFoundProblemSchema, "Aluno não encontrado")
        .build()
} satisfies IO;
const listPeople = {
    meta: {
        method: "get" as const,
        path: peoplePath,
        tags: ["student-social"],
        authorization: read
    },
    request: z.object({
        path: sidPath,
        query: z.object({
            query: z.string().trim().min(3),
            page: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().min(1))
                .default(1),
            pageSize: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().min(1).max(50))
                .default(20)
        })
    }),
    response: new OutputBuilder()
        .ok(
            z
                .object({
                    items: z.array(person),
                    page: z.number(),
                    pageSize: z.number(),
                    total: z.number()
                })
                .strict(),
            "Pessoas recuperadas"
        )
        .build()
} satisfies IO;
const getPerson = {
    meta: {
        method: "get" as const,
        path: [...peoplePath, pathSeg.param("publicId")],
        tags: ["student-social"],
        authorization: read
    },
    request: z.object({ path: publicIdPath }),
    response: new OutputBuilder()
        .ok(person, "Pessoa recuperada")
        .problem(404, ResourceNotFoundProblemSchema, "Pessoa não encontrada")
        .build()
} satisfies IO;
const listFriendships = {
    meta: {
        method: "get" as const,
        path: friendshipsPath,
        tags: ["student-social"],
        authorization: read
    },
    request: z.object({
        path: sidPath,
        query: z.object({
            status: z.enum(["PENDING", "ACCEPTED"]).optional(),
            direction: z.enum(["INCOMING", "OUTGOING"]).optional()
        })
    }),
    response: new OutputBuilder()
        .ok(z.array(friendship), "Amizades recuperadas")
        .build()
} satisfies IO;
const createFriendship = {
    meta: {
        method: "post" as const,
        path: friendshipsPath,
        tags: ["student-social"],
        authorization: write
    },
    request: z.object({
        path: sidPath,
        body: z.object({ targetPublicId: z.string().uuid() }).strict()
    }),
    response: new OutputBuilder()
        .created(friendship, "Solicitação de amizade criada")
        .problem(404, ResourceNotFoundProblemSchema, "Pessoa não encontrada")
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Solicitação conflitante"
        )
        .build()
} satisfies IO;
const acceptFriendship = {
    meta: {
        method: "post" as const,
        path: [
            ...friendshipsPath,
            pathSeg.param("id"),
            pathSeg.literal("accept")
        ],
        tags: ["student-social"],
        authorization: write
    },
    request: z.object({ path: friendshipPath }),
    response: new OutputBuilder()
        .ok(friendship, "Amizade aceita")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Solicitação não encontrada"
        )
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Solicitação não pode ser aceita"
        )
        .build()
} satisfies IO;
const removeFriendship = {
    meta: {
        method: "delete" as const,
        path: [...friendshipsPath, pathSeg.param("id")],
        tags: ["student-social"],
        authorization: write
    },
    request: z.object({ path: friendshipPath }),
    response: new OutputBuilder()
        .noContent()
        .problem(404, ResourceNotFoundProblemSchema, "Amizade não encontrada")
        .build()
} satisfies IO;

export default {
    schemas: { person, ownProfile, friendship },
    getProfile,
    updateProfile,
    listPeople,
    getPerson,
    listFriendships,
    createFriendship,
    acceptFriendship,
    removeFriendship
};
