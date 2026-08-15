import {
    ApiResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import { catalogProgramProblemResponses } from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";

const { schemas: _schemas, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(catalogProgramProblemResponses);

const list: Actions["list"] = async (ctx, input) =>
    ApiResponse.ok(await ctx.catalogProgramService.list(input.query));

const get: Actions["get"] = async (ctx, input) => {
    return respond(
        await ctx.catalogProgramService.getById(input.path.id),
        ApiResponse.ok
    );
};

const actions: Actions = { list, get };
const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    actions
);

function listPath() {
    return "/catalog-program";
}

function entityPath(id: number) {
    return `/catalog-program/${id}`;
}

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    }
};
