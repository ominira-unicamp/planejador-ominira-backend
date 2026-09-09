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

export const catalogCoursePaths = {
    list: (query: ListQueryParams = {}) => {
        const search = serializeQueryParams(
            query as unknown as Record<string, unknown>
        );
        return `/catalog-courses${search ? `?${search}` : ""}`;
    },
    entity: (id: number) => `/catalog-courses/${id}`
};

const basePath = [pathSeg.literal("catalog-courses")];
const tags = ["catalog-courses"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const offeringPeriodValues = [
    "ALL_PERIODS",
    "ODD_PERIODS",
    "EVEN_PERIODS",
    "UNIT_DISCRETION"
] as const;
const offeringPeriod = z
    .enum(offeringPeriodValues)
    .openapi("CourseOfferingPeriod");

const coordinator = z
    .object({
        id: z.number().int(),
        name: z.string().min(1)
    })
    .strict();

const workload = z
    .object({
        theoreticalHours: z.number().int().nullable(),
        practicalHours: z.number().int().nullable(),
        laboratoryHours: z.number().int().nullable(),
        guidedActivityHours: z.number().int().nullable(),
        distanceHours: z.number().int().nullable(),
        guidedExtensionHours: z.number().int().nullable(),
        practicalExtensionHours: z.number().int().nullable(),
        weeks: z.number().int().nullable(),
        weeklyClassHours: z.number().int().nullable(),
        classroomHours: z.number().int().nullable()
    })
    .strict();

const prerequisiteItem = z
    .object({
        code: z.string().min(1),
        kind: z.enum(["FULL", "PARTIAL", "SPECIAL"]),
        courseId: z.number().int().nullable()
    })
    .strict();

export type CatalogCourseFilterValue = FilterValue;
export type CatalogCourseFilter = Filter;

const catalogCourseFilterDefinitions = {
    "catalogId": filterDefinition.id(),
    "catalogYear": filterDefinition.integer(),
    "courseId": filterDefinition.id(),
    "courseCode": filterDefinition.code({ nonEmpty: false }),
    "unit.id": filterDefinition.id(),
    "unit.code": filterDefinition.code({
        nonEmpty: false,
        operators: equalityOperators
    }),
    "coordinatorId": filterDefinition.id(),
    "offeringPeriod": filterDefinition.enum(offeringPeriodValues)
};
export type CatalogCourseFilterName =
    keyof typeof catalogCourseFilterDefinitions;

const catalogCourseFilter = resourceFilterSchema(
    catalogCourseFilterDefinitions,
    "catalog courses",
    "Structured catalog course filters. Use bracket notation such as filter[unit][code]=IC."
);

const prerequisites = z
    .object({
        any: z.array(z.object({ all: z.array(prerequisiteItem) }).strict())
    })
    .strict();

const catalogCourseEntity = z
    .object({
        id: z.number().int(),
        catalogId: z.number().int(),
        catalogYear: z.number().int(),
        courseId: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        credits: z.number().int().min(0),
        coordinator: coordinator.nullable(),
        workload,
        offeringPeriod: offeringPeriod.nullable(),
        evaluation: z.string().nullable(),
        finalExam: z.boolean().nullable(),
        minimumAttendancePercent: z.number().int().nullable(),
        syllabus: z.string().nullable(),
        bibliography: z.string().nullable(),
        sourceUrl: z.string().nullable(),
        prerequisites,
        _paths: z
            .object({
                self: z.string(),
                catalog: z.string(),
                course: z.string(),
                coordinator: z.string().nullable()
            })
            .strict()
    })
    .strict()
    .openapi("CatalogCourseEntity");

const listQuery = z
    .object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).optional(),
        filter: catalogCourseFilter.optional()
    })
    .strict()
    .openapi("ListCatalogCoursesQuery");

export type ListQueryParams = z.infer<typeof listQuery>;

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.public,
        queryFeatures: { filter: true }
    },
    request: z.object({ query: listQuery }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(catalogCourseEntity),
            "List of catalog courses retrieved successfully"
        )
        .build()
} satisfies IO;

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({ id: z.coerce.number().int() }).strict()
    }),
    response: new OutputBuilder()
        .ok(catalogCourseEntity, "Catalog course retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

export default { schema: catalogCourseEntity, list, get };
