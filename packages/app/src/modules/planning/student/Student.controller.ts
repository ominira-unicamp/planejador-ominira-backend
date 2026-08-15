import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/student/Student.contract.js";
import { studentProblemResponses } from "#/modules/planning/student/Student.problems.js";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentProblemResponses);

const list: Actions["list"] = async (ctx) =>
    ApiResponse.ok(await ctx.studentService.list());

const get: Actions["get"] = async (ctx, input) =>
    respond(await ctx.studentService.getById(input.path.id), ApiResponse.ok);

const create: Actions["create"] = async (ctx, input) => {
    const result = await ctx.studentService.create(ctx.principal, input.body);
    return respond(
        result,
        ({ student, linked }) =>
            linked ? ApiResponse.ok(student) : ApiResponse.created(student),
        problemInput.body
    );
};

const patch: Actions["patch"] = async (ctx, input) =>
    respond(
        await ctx.studentService.patch(input.path.id, input.body),
        ApiResponse.ok,
        problemInput.body
    );

const remove: Actions["remove"] = async (ctx, input) =>
    respond(
        await ctx.studentService.remove(
            input.path.id,
            input.body.confirmationRa
        ),
        () => ApiResponse.noContent(),
        problemInput.body
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
    paths: { entity: (studentId: number) => `/students/${studentId}` }
};
