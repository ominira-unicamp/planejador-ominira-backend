import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    PaginationQueryType,
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

const listProfessorsQuery = paginationQuerySchema
    .extend({
        classId: z.coerce.number().int().optional()
    })
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

export type ListQueryParams = {
    classId?: number;
} & Partial<PaginationQueryType>;
