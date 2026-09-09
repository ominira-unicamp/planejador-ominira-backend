import {
    ApiResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, { roomPaths } from "#/modules/academic/room/Room.contract.js";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});

const actions: Actions = {
    list: async (ctx, input) =>
        ApiResponse.ok(await ctx.roomService.list(input.query)),
    get: async (ctx, input) =>
        respond(await ctx.roomService.getById(input.path.id), ApiResponse.ok)
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
    paths: { entity: roomPaths.entity }
};
