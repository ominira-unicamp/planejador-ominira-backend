import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, { unitPaths } from "#/modules/academic/unit/Unit.contract.js";
import {
    ApiResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";
const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});
const actions: Actions = {
    list: async (ctx) => ApiResponse.ok(await ctx.unitService.list()),
    get: async (ctx, input) =>
        respond(await ctx.unitService.getById(input.path.id), ApiResponse.ok)
};
const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    actions
);
export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: { entity: unitPaths.entity }
};
