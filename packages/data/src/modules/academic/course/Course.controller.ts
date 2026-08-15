import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/academic/course/Course.contract.js";
import courseEntity from "#/modules/academic/course/Course.entity.js";
import {
    buildPaginationResponse,
    PaginationQueryType,
    prismaPaginationParamsFromQuery
} from "@pomi/api-core";

extendZodWithOpenApi(z);

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { query } = input;
    const where = {
        code: {
            contains: query.courseCode,
            mode: "insensitive" as const
        },
        unit: {
            ...(query.unitId ? { id: query.unitId } : {}),
            ...(query.unitCode ? { code: query.unitCode } : {})
        }
    };
    const delegate = ctx.prisma.course;
    const total = await delegate.count({ where });
    const hasExplicitPagination =
        query.page !== undefined || query.pageSize !== undefined;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const data = await delegate.findMany({
        ...(hasExplicitPagination
            ? prismaPaginationParamsFromQuery({ page, pageSize })
            : {}),
        ...courseEntity.selection,
        where
    });
    const paginationQuery: PaginationQueryType = {
        page: hasExplicitPagination ? page : 1,
        pageSize: hasExplicitPagination ? pageSize : Math.max(total, 1)
    };
    const entities = data.map(courseEntity.build) as Array<
        z.infer<typeof IO.schema>
    >;
    return {
        200: buildPaginationResponse<typeof IO.schema>(
            entities,
            total,
            paginationQuery,
            (pageNumber) =>
                listPath({
                    ...query,
                    page: pageNumber,
                    pageSize: paginationQuery.pageSize
                })
        )
    };
};

const list = buildHandler(IO.list.request, IO.list.response, listFn);

const get = defaultGetHandler(
    (p) => p.course,
    courseEntity.selection,
    courseEntity.build,
    "Course not found"
);

const router = Router();
const authRegistry = new AuthRegistry();

router.get("/courses/:id", get);

authRegistry.addException("GET", "/courses");
router.get("/courses", list);

function entityPath(courseId: number) {
    return `/courses/${courseId}`;
}

type ListQueryParams = {
    unitId?: number;
    unitCode?: string;
    courseCode?: string;
} & Partial<PaginationQueryType>;

function listPath(query: ListQueryParams) {
    return (
        `/courses?` +
        [
            query.unitId ? "unitId=" + query.unitId : undefined,
            query.unitCode ? "unitCode=" + query.unitCode : undefined,
            query.courseCode ? "courseCode=" + query.courseCode : undefined,
            query.page ? "page=" + query.page : undefined,
            query.pageSize ? "pageSize=" + query.pageSize : undefined
        ]
            .filter(Boolean)
            .join("&")
    );
}

authRegistry.addException("GET", "/courses/:id");

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        list: listPath,
        entity: entityPath
    },
    entity: courseEntity
};
