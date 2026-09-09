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
    pathSeg,
    serializeQueryParams,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const coordinatorPaths = {
    list: (query: ListQueryParams = {}) => {
        const search = serializeQueryParams(
            query as unknown as Record<string, unknown>
        );
        return `/coordinators${search ? `?${search}` : ""}`;
    },
    entity: (id: number) => `/coordinators/${id}`
};

const basePath = [pathSeg.literal("coordinators")];
const tags = ["coordinators"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const coordinatorEntity = z
    .object({
        id: z.number().int(),
        name: z.string().min(1),
        catalogCoursesCount: z.number().int(),
        _paths: z
            .object({ self: z.string(), catalogCourses: z.string() })
            .strict()
    })
    .strict()
    .openapi("CoordinatorEntity");

export type CoordinatorFilter = Filter;
const coordinatorFilterDefinitions = {
    name: filterDefinition.code({ operators: ["eq"] })
};
export type CoordinatorFilterName = keyof typeof coordinatorFilterDefinitions;
const coordinatorFilter = resourceFilterSchema(
    coordinatorFilterDefinitions,
    "coordinators",
    "Structured coordinator filters. Use bracket notation such as filter[name]=Ada."
);

const listQuery = z
    .object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).optional(),
        filter: coordinatorFilter.optional()
    })
    .openapi("ListCoordinatorsQuery");

export type ListQueryParams = z.infer<typeof listQuery>;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({ query: listQuery.strict() }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(coordinatorEntity),
            "List of coordinators retrieved successfully"
        )
        .build()
} satisfies IO;

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({ id: z.coerce.number().int() }).strict()
    }),
    response: new OutputBuilder()
        .ok(coordinatorEntity, "Coordinator retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

export default { schema: coordinatorEntity, list, get };
