import { type IO, OutputBuilder } from "#/BuildHandler.js";
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

const basePath = [pathSeg.literal("professors")];
const tags = ["professors"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const professorEntity = z
    .object({
        id: z.number().int(),
        name: z.string(),
        _paths: z.object({
            entity: z.string()
        })
    })
    .strict()
    .openapi("ProfessorEntity");

const professorBase = z
    .object({
        id: z.number().int(),
        name: z.string().min(1)
    })
    .strict();

const createProfessorBody = professorBase
    .omit({ id: true })
    .openapi("CreateProfessorBody");

const patchProfessorBody = professorBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchProfessorBody");

const listProfessorsQuery = paginationQuerySchema
    .extend({
        classId: z.coerce.number().int().optional()
    })
    .openapi("ListProfessorsQuery");

const PageProfessorsSchema =
    getPaginatedSchema(professorEntity).openapi("PageProfessors");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(professorEntity, "Professor retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: listProfessorsQuery
    }),
    output: new OutputBuilder()
        .ok(PageProfessorsSchema, "List of professors retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createProfessorBody.strict()
    }),
    output: new OutputBuilder()
        .created(professorEntity, "Professor created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchProfessorBody
    }),
    output: new OutputBuilder()
        .ok(professorEntity, "Professor updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Professor deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: professorEntity,
    get,
    list,
    create,
    patch,
    remove
};

export type ListQueryParams = {
    classId?: number;
} & Partial<PaginationQueryType>;
