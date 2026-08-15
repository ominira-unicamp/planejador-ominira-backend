import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/student-course-attempt/StudentCourseAttempt.contract.js";
import { studentCourseAttemptProblemResponses } from "#/modules/planning/student-course-attempt/StudentCourseAttempt.problems.js";

const { schema: _schema, statusSchema: _statusSchema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentCourseAttemptProblemResponses);

const list: Actions["list"] = async (ctx, input) =>
    ApiResponse.ok(
        await ctx.studentCourseAttemptService.list(input.path.sid, input.query)
    );

const get: Actions["get"] = async (ctx, input) =>
    respond(
        await ctx.studentCourseAttemptService.getById(
            input.path.sid,
            input.path.id
        ),
        ApiResponse.ok
    );

const create: Actions["create"] = async (ctx, input) =>
    respond(
        await ctx.studentCourseAttemptService.create(
            input.path.sid,
            input.body
        ),
        ApiResponse.created,
        problemInput.body
    );

const patch: Actions["patch"] = async (ctx, input) =>
    respond(
        await ctx.studentCourseAttemptService.patch(
            input.path.sid,
            input.path.id,
            input.body
        ),
        ApiResponse.ok,
        problemInput.body
    );

const remove: Actions["remove"] = async (ctx, input) =>
    respond(
        await ctx.studentCourseAttemptService.remove(
            input.path.sid,
            input.path.id
        ),
        () => ApiResponse.noContent()
    );

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    {
        list,
        get,
        create,
        patch,
        remove
    }
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        entity: (studentId: number, id: number) =>
            `/student/${studentId}/course-attempts/${id}`
    }
};
