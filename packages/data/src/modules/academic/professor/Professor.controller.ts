import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, {
    professorPaths,
    type ListQueryParams
} from "#/modules/academic/professor/Professor.contract.js";
import { ResourceNotFoundProblem, problemResponse } from "@pomi/api-core";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});

const list: Actions["list"] = async (ctx, input) => {
    const result = await ctx.professorService.list(input.query);
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? Math.max(result.total, 1);
    return ApiResponse.ok(
        buildPaginationResponse<typeof IO.schema>(
            result.items,
            result.total,
            { page, pageSize },
            (pageNumber) =>
                listPath({ ...input.query, page: pageNumber, pageSize })
        )
    );
};

const get: Actions["get"] = async (ctx, input) =>
    respond(await ctx.professorService.getById(input.path.id), ApiResponse.ok);

function listPath(query: ListQueryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
        if (value !== undefined) params.set(key, String(value));
    const search = params.toString();
    return `/professors${search ? `?${search}` : ""}`;
}

const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    { list, get }
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: { list: listPath, entity: professorPaths.entity }
};
