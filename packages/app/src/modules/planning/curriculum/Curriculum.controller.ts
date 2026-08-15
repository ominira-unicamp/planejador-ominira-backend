import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/curriculum/Curriculum.contract.js";
import { curriculumProblemResponses } from "#/modules/planning/curriculum/Curriculum.problems.js";
import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

const { schema: _schema, summarySchema: _summarySchema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(curriculumProblemResponses);

const actions: Actions = {
    list: async (ctx, input) =>
        ApiResponse.ok(await ctx.curriculumService.list(input.path.sid)),
    get: async (ctx, input) =>
        respond(
            await ctx.curriculumService.getById(input.path.sid, input.path.id),
            ApiResponse.ok
        ),
    create: async (ctx, input) =>
        respond(
            await ctx.curriculumService.create(input.path.sid, input.body),
            ApiResponse.created,
            problemInput.body
        ),
    patch: async (ctx, input) =>
        respond(
            await ctx.curriculumService.patch(
                input.path.sid,
                input.path.id,
                input.body
            ),
            ApiResponse.ok,
            problemInput.body
        ),
    remove: async (ctx, input) =>
        respond(
            await ctx.curriculumService.remove(input.path.sid, input.path.id),
            () => ApiResponse.noContent()
        )
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        entity: (studentId: number, id: number) =>
            `/student/${studentId}/curricula/${id}`
    }
};
