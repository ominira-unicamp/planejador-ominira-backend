import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO from "#/modules/catalog/program/Program.contract.js";
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
    list: async (ctx, input) =>
        ApiResponse.ok(await ctx.programService.list(input.query)),
    get: async (ctx, input) =>
        respond(await ctx.programService.getById(input.path.id), ApiResponse.ok)
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
    paths: { entity: (id: number) => `/programs/${id}` }
};
