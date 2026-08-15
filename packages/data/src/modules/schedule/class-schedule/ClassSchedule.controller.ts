import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import { coursePaths } from "#/modules/academic/course/Course.contract.js";
import { unitPaths } from "#/modules/academic/unit/Unit.contract.js";
import IO, {
    classScheduleDataSchema,
    classScheduleEntity,
    classSchedulePaths,
    type ListQueryParams
} from "#/modules/schedule/class-schedule/ClassSchedule.contract.js";
import { classScheduleProblemResponses } from "#/modules/schedule/class-schedule/ClassSchedule.problems.js";
import { classPaths } from "#/modules/schedule/class/Class.contract.js";
import { studyPeriodPaths } from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import type z from "zod";

function withPaths(
    schedule: z.infer<typeof classScheduleDataSchema>
): z.infer<typeof classScheduleEntity> {
    return {
        ...schedule,
        _paths: {
            entity: classSchedulePaths.entity(schedule.id),
            studyPeriod: studyPeriodPaths.entity(schedule.studyPeriodId),
            unit: unitPaths.entity(schedule.unitId),
            course: coursePaths.entity(schedule.courseId),
            class: classPaths.entity(schedule.classId)
        }
    };
}
type Actions = EndpointActions<typeof IO, unknown, Context>;
const respond = createResultResponder(classScheduleProblemResponses);

const list: Actions["list"] = async (ctx, input) => {
    const result = await ctx.classScheduleService.list(input.query);
    return ApiResponse.ok(
        buildPaginationResponse<typeof classScheduleEntity>(
            result.items.map(withPaths),
            result.total,
            input.query,
            (page) => listPath({ ...input.query, page })
        )
    );
};
const get: Actions["get"] = async (ctx, input) => {
    return respond(
        await ctx.classScheduleService.getById(input.path.id),
        (value) => ApiResponse.ok(withPaths(value))
    );
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
const actions: Actions = {
    list,
    get
};
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
        entity: classSchedulePaths.entity
    }
};
