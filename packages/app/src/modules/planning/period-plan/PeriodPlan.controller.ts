import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/period-plan/PeriodPlan.contract.js";
import { periodPlanProblemResponses } from "#/modules/planning/period-plan/PeriodPlan.problems.js";
import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

const { schema: _schema, aliases: _aliases, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(periodPlanProblemResponses);

export const periodPlanActions: Actions = {
    list: async (ctx, input) =>
        ApiResponse.ok(await ctx.periodPlanService.list(input.path.sid)),
    get: async (ctx, input) =>
        respond(
            await ctx.periodPlanService.getById(input.path.sid, input.path.id),
            ApiResponse.ok
        ),
    create: async (ctx, input) =>
        respond(
            await ctx.periodPlanService.create(input.path.sid, input.body),
            ApiResponse.created,
            problemInput.body
        ),
    patch: async (ctx, input) =>
        respond(
            await ctx.periodPlanService.patch(
                input.path.sid,
                input.path.id,
                input.body
            ),
            ApiResponse.ok,
            problemInput.body
        ),
    remove: async (ctx, input) =>
        respond(
            await ctx.periodPlanService.remove(input.path.sid, input.path.id),
            () => ApiResponse.noContent()
        )
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    periodPlanActions
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        entity: (studentId: number, id: number) =>
            `/student/${studentId}/period-plannings/${id}`
    }
};
