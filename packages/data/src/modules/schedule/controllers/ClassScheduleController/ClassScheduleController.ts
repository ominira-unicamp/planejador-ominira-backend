import {
    ApiResponse,
    buildPaginationResponse,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, {
    classScheduleEntity,
    type ListQueryParams
} from "#/modules/schedule/contracts/ClassScheduleInterface.js";
import { classScheduleProblemDetails } from "#/modules/schedule/problems/ClassScheduleProblems.js";

const actions: EndpointActions<typeof IO, unknown, Context> = {
    list: async (ctx, input) => {
        const result = await ctx.classScheduleService.list(input.query);
        return ApiResponse.ok(
            buildPaginationResponse<typeof classScheduleEntity>(
                result.items,
                result.total,
                input.query,
                (page) => listPath({ ...input.query, page })
            )
        );
    },
    get: async (ctx, input) => {
        const result = await ctx.classScheduleService.getById(input.path.id);
        return result.match(
            (value) => ApiResponse.ok(value),
            (error) => {
                return ApiResponse.status(
                    404,
                    classScheduleProblemDetails(error)
                );
            }
        );
    },
    create: async (ctx, input) => {
        const result = await ctx.classScheduleService.create(input.body);
        return result.match(
            (value) => ApiResponse.created(value),
            (error) =>
                ApiResponse.status(
                    400,
                    classScheduleProblemDetails(error, "body")
                )
        );
    },
    patch: async (ctx, input) => {
        const result = await ctx.classScheduleService.patch(
            input.path.id,
            input.body
        );
        return result.match(
            (value) => ApiResponse.ok(value),
            (error) => {
                if (
                    error.type ===
                    "urn:pomi:problem:class-schedule-reference-not-found"
                ) {
                    return ApiResponse.status(
                        400,
                        classScheduleProblemDetails(error, "body")
                    );
                }

                return ApiResponse.status(
                    404,
                    classScheduleProblemDetails(error, "body")
                );
            }
        );
    },
    remove: async (ctx, input) => {
        const result = await ctx.classScheduleService.remove(input.path.id);
        return result.match(
            () => ApiResponse.noContent(),
            (error) => {
                return ApiResponse.status(
                    404,
                    classScheduleProblemDetails(error)
                );
            }
        );
    }
};

function listPath({
    unitId,
    courseId,
    studyPeriodId,
    classId,
    page,
    pageSize
}: ListQueryParams) {
    return (
        `/class-schedules?` +
        [
            unitId ? "unitId=" + unitId : undefined,
            courseId ? "courseId=" + courseId : undefined,
            studyPeriodId ? "studyPeriodId=" + studyPeriodId : undefined,
            classId ? "classId=" + classId : undefined,
            page ? "page=" + page : undefined,
            pageSize ? "pageSize=" + pageSize : undefined
        ]
            .filter(Boolean)
            .join("&")
    );
}

const { router, registry, authRegistry } = createDataEndpointRegistries(
    IO,
    actions
);

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        list: listPath,
        entity: (id: number) => `/class-schedules/${id}`
    }
};
