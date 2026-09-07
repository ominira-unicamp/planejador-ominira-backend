import type { AuthorizationPolicy } from "#/auth.js";
import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO from "#/modules/planning/shared-period-plan/SharedPeriodPlan.contract.js";
import {
    ApiResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";

const { schema: _schema, specsBuilder: _specsBuilder, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});

const actions: Actions = {
    listPublic: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.sharedPeriodPlanService.listPublic(input.query)
        ),
    getPublic: async (ctx, input) =>
        respond(
            await ctx.sharedPeriodPlanService.getPublic(input.path.shareId),
            ApiResponse.ok
        ),
    listForStudent: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.sharedPeriodPlanService.listForStudent(
                input.path.sid,
                input.query
            )
        ),
    getForStudent: async (ctx, input) =>
        respond(
            await ctx.sharedPeriodPlanService.getForStudent(
                input.path.sid,
                input.path.shareId
            ),
            ApiResponse.ok
        )
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);

export default { contracts, router, registry, authRegistry };
