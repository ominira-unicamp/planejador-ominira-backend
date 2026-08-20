import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/student-absence/StudentAbsence.contract.js";
import { studentAbsenceProblemResponses } from "#/modules/planning/student-absence/StudentAbsence.problems.js";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentAbsenceProblemResponses);

const list: Actions["list"] = async (ctx, input) =>
    ApiResponse.ok(
        await ctx.studentAbsenceService.list(input.path.sid, input.query)
    );

const create: Actions["create"] = async (ctx, input) =>
    respond(
        await ctx.studentAbsenceService.create(input.path.sid, input.body),
        ApiResponse.created,
        problemInput.body
    );

const remove: Actions["remove"] = async (ctx, input) =>
    respond(
        await ctx.studentAbsenceService.remove(input.path.sid, input.path.id),
        () => ApiResponse.noContent()
    );

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    { list, create, remove }
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        entity: (studentId: number, id: number) =>
            `/student/${studentId}/absences/${id}`,
        list: (studentId: number, courseAttemptId?: number) =>
            `/student/${studentId}/absences${
                courseAttemptId ? `?courseAttemptId=${courseAttemptId}` : ""
            }`
    }
};
