import { OutputBuilder, type IO } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    filterDefinition,
    resourceFilterSchema,
    type Filter
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    pathSeg,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const professorPaths = {
    entity: (id: number) => `/professors/${id}`
};

const basePath = [pathSeg.literal("professors")];
const tags = ["professors"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const professorEntity = z
    .object({
        id: z.number().int(),
        name: z.string(),
        _paths: z.object({
            entity: z.string(),
            dataPortalProfile: z.string().nullable()
        })
    })
    .strict()
    .openapi("ProfessorEntity");

export type ProfessorFilter = Filter;
const professorFilterDefinitions = { classId: filterDefinition.id() };
export type ProfessorFilterName = keyof typeof professorFilterDefinitions;
const professorFilter = resourceFilterSchema(
    professorFilterDefinitions,
    "professors",
    "Structured professor filters. Use bracket notation such as filter[classId]=1."
);

const listProfessorsQuery = paginationQuerySchema
    .extend({ filter: professorFilter.optional() })
    .strict()
    .openapi("ListProfessorsQuery");

const PageProfessorsSchema =
    getPaginatedSchema(professorEntity).openapi("PageProfessors");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(professorEntity, "Professor retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: listProfessorsQuery
    }),
    response: new OutputBuilder()
        .ok(PageProfessorsSchema, "List of professors retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

export default {
    schema: professorEntity,
    get,
    list
};

export type ListQueryParams = Partial<z.infer<typeof listProfessorsQuery>>;
