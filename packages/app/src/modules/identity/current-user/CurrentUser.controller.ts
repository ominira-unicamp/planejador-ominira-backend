import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/identity/current-user/CurrentUser.contract.js";
import { ApiResponse, type EndpointActions } from "@pomi/api-core";

const { schemas: _schemas, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;

const actions: Actions = {
    get: async (ctx) =>
        ApiResponse.ok(ctx.currentUserService.get(ctx.principal!))
};
const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);

export default { contracts, router, registry, authRegistry };
