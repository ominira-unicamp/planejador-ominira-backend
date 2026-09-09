import { OutputBuilder, type IO } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    equalityOperators,
    filterDefinition,
    resourceFilterSchema,
    type Filter,
    type FilterValue
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

export const coursePaths = {
    list: (query: ListQueryParams = {}) => {
        const search = serializeQueryParams(
            query as unknown as Record<string, unknown>
        );
        return `/courses${search ? `?${search}` : ""}`;
    },
    entity: (id: number) => `/courses/${id}`
};

const basePath = [pathSeg.literal("courses")];
const tags = ["courses"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const courseEntity = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        credits: z.number().int().min(0),
        prefix: z.string().min(1),
        unitId: z.number().int().nullable(),
        unitCode: z.string().min(1).nullable(),
        _paths: z
            .object({
                classes: z.string(),
                unit: z.string().nullable(),
                catalogCourses: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CourseEntity");

export type CourseFilterValue = FilterValue;
export type CourseFilter = Filter;

const courseFilterDefinitions = {
    "catalogYear": filterDefinition.integer(),
    "code": filterDefinition.code(),
    "credits": filterDefinition.integer({
        minimum: 0,
        operators: ["eq", "ne", "gt", "gte", "lt", "lte", "in"]
    }),
    "tagId": filterDefinition.id({ positive: true }),
    "unit.code": filterDefinition.code({ operators: equalityOperators }),
    "unit.id": filterDefinition.id({ positive: true })
};

const courseFilter = resourceFilterSchema(
    courseFilterDefinitions,
    "courses",
    "Structured course filters. Use bracket notation such as filter[credits][gte]=4.",
    {
        credits: { gte: 4 },
        unit: { code: "IC" }
    }
);

const listCourseQuery = z
    .object({
        page: z.coerce.number().int().min(1).optional().openapi({
            description:
                "Page number. If omitted together with pageSize, all courses are returned."
        }),
        pageSize: z.coerce.number().int().min(1).optional().openapi({
            description:
                "Number of courses per page. If omitted together with page, all courses are returned."
        }),
        filter: courseFilter.optional()
    })
    .strict()
    .openapi("ListCoursesQuery");
export type ListQueryParams = z.infer<typeof listCourseQuery>;

const PageCoursesSchema =
    getPaginatedSchema(courseEntity).openapi("PageCourses");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z
            .object({
                id: z.coerce.number().int()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(courseEntity, "Course retrieved successfully")
        .notFound()
        .build()
};

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.public,
        queryFeatures: { filter: true }
    },
    request: z.object({
        query: listCourseQuery
    }),
    response: new OutputBuilder()
        .ok(PageCoursesSchema, "List of courses retrieved successfully")
        .build()
} satisfies IO;

export default {
    schema: courseEntity,
    get,
    list
};
