import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/identity/auth-user/AuthUser.contract.js";
import { authUserProblemResponses } from "#/modules/identity/auth-user/AuthUser.problems.js";
import {
    ApiResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";
const { schemas: _schemas, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(authUserProblemResponses);
const actions: Actions = {
    list: async (ctx) => ApiResponse.ok(await ctx.authUserService.list()),
    create: async (ctx, input) =>
        ApiResponse.created(
            await ctx.authUserService.create(ctx.principal!, input.body)
        ),
    patch: async (ctx, input) =>
        respond(
            await ctx.authUserService.patch(input.path.id, input.body),
            ApiResponse.ok
        )
};
const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);
export default { contracts, router, registry, authRegistry };
