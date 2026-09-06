import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    pathSeg,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const profileBase = [pathSeg.literal("professor-data-portal-profiles")];
const profileSpecs = new SpecBuilder(
    profileBase,
    ["professor-data-portal"],
    "id"
);
const idPath = z.object({
    id: z.string().pipe(z.coerce.number()).pipe(z.number().int().positive())
});
const profileId = z.number().int().positive();
const careerReference = z
    .object({
        career: z.string(),
        code: z.string(),
        rank: z.string().nullable(),
        category: z.string().nullable(),
        progressionOrder: z.number().int()
    })
    .strict();
const position = z
    .object({
        id: profileId,
        canonicalKey: z.string(),
        role: z.string(),
        affiliationType: z.string(),
        programCode: z.string().nullable(),
        postdoctoralModality: z.string().nullable(),
        careerReference: careerReference.nullable()
    })
    .strict();
const unit = z
    .object({ id: profileId, code: z.string(), name: z.string() })
    .strict();
const department = z
    .object({ id: profileId, name: z.string(), unitId: profileId })
    .strict();
const identifier = z
    .object({ id: profileId, system: z.string(), externalId: z.string() })
    .strict();
const citationName = z.object({ id: profileId, name: z.string() }).strict();
const training = z
    .object({
        id: profileId,
        degree: z.string(),
        institutionName: z.string(),
        startYear: z.number().int().nullable(),
        endYear: z.number().int().nullable()
    })
    .strict();
const keyword = z
    .object({
        id: profileId,
        name: z.string(),
        count: z.number().int().nullable()
    })
    .strict();
const coauthor = z
    .object({
        id: profileId,
        name: z.string(),
        count: z.number().int().nullable()
    })
    .strict();

const profile = z
    .object({
        id: profileId,
        professorId: profileId,
        portalId: profileId,
        name: z.string(),
        email: z.string().nullable(),
        lattesAbstract: z.string().nullable(),
        unit,
        department: department.nullable(),
        position: position.nullable(),
        identifiers: z.array(identifier),
        citationNames: z.array(citationName),
        trainings: z.array(training),
        keywords: z.array(keyword),
        coauthors: z.array(coauthor),
        _paths: z.object({ self: z.string(), professor: z.string() }).strict()
    })
    .strict()
    .openapi("ProfessorDataPortalProfile");
export const profileSummary = profile.pick({
    id: true,
    professorId: true,
    portalId: true,
    name: true,
    email: true,
    lattesAbstract: true,
    unit: true,
    department: true,
    position: true,
    _paths: true
});

const profileList = {
    meta: { ...profileSpecs.list(), authorization: policies.public },
    request: z.object({
        query: paginationQuerySchema.extend({
            professorId: z.coerce.number().int().positive().optional(),
            portalId: z.coerce.number().int().positive().optional(),
            unitId: z.coerce.number().int().positive().optional(),
            departmentId: z.coerce.number().int().positive().optional(),
            positionId: z.coerce.number().int().positive().optional(),
            name: z.string().trim().min(1).optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(profileSummary),
            "Profiles retrieved successfully"
        )
        .badRequest()
        .build()
} satisfies IO;
const profileGet = {
    meta: { ...profileSpecs.get(), authorization: policies.public },
    request: z.object({ path: idPath }),
    response: new OutputBuilder()
        .ok(profile, "Profile retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const simpleList = (
    path: string,
    tag: string,
    schema: z.ZodTypeAny,
    query = z.object({})
) => ({
    meta: {
        ...new SpecBuilder([pathSeg.literal(path)], [tag], "id").list(),
        authorization: policies.public
    },
    request: z.object({ query }),
    response: new OutputBuilder()
        .ok(z.array(schema), `${tag} retrieved successfully`)
        .badRequest()
        .build()
});
const simpleGet = (path: string, tag: string, schema: z.ZodTypeAny) => ({
    meta: {
        ...new SpecBuilder([pathSeg.literal(path)], [tag], "id").get(),
        authorization: policies.public
    },
    request: z.object({ path: idPath }),
    response: new OutputBuilder()
        .ok(schema, `${tag} retrieved successfully`)
        .notFound()
        .build()
});

export const positionSchema = position;
export const departmentSchema = department;
export const keywordSchema = z
    .object({ id: profileId, name: z.string() })
    .strict();
export const coauthorSchema = keywordSchema;
const keywordList = {
    meta: {
        ...new SpecBuilder(
            [pathSeg.literal("keywords")],
            ["keywords"],
            "id"
        ).list(),
        authorization: policies.public
    },
    request: z.object({
        query: paginationQuerySchema.extend({
            name: z.string().trim().min(1).optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(keywordSchema),
            "Keywords retrieved successfully"
        )
        .badRequest()
        .build()
};
const coauthorList = {
    meta: {
        ...new SpecBuilder(
            [pathSeg.literal("coauthors")],
            ["coauthors"],
            "id"
        ).list(),
        authorization: policies.public
    },
    request: z.object({
        query: paginationQuerySchema.extend({
            name: z.string().trim().min(1).optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(coauthorSchema),
            "Coauthors retrieved successfully"
        )
        .badRequest()
        .build()
};
export default {
    profile: { schema: profile, list: profileList, get: profileGet },
    positions: {
        list: simpleList(
            "professor-positions",
            "professor-positions",
            position
        ),
        get: simpleGet("professor-positions", "professor-positions", position)
    },
    departments: {
        list: simpleList(
            "departments",
            "departments",
            department,
            z.object({
                unitId: z.coerce.number().int().positive().optional(),
                name: z.string().trim().min(1).optional()
            })
        ),
        get: simpleGet("departments", "departments", department)
    },
    keywords: {
        list: keywordList,
        get: simpleGet("keywords", "keywords", keywordSchema)
    },
    coauthors: {
        list: coauthorList,
        get: simpleGet("coauthors", "coauthors", coauthorSchema)
    }
};
