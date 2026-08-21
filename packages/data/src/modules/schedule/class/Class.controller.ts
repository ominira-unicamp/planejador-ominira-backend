import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, { classPaths } from "#/modules/schedule/class/Class.contract.js";
import {
    ApiResponse,
    buildPaginationResponse,
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

function listPath(query: Record<string, unknown>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
        if (value !== undefined) params.set(key, String(value));
    const search = params.toString();
    return `/classes${search ? `?${search}` : ""}`;
}

const actions: Actions = {
    list: async (ctx, input) => {
        const result = await ctx.classService.list(input.query);
        const page = input.query.page ?? 1;
        const pageSize = input.query.pageSize ?? Math.max(result.total, 1);
        return ApiResponse.ok(
            buildPaginationResponse<typeof IO.schema>(
                result.items,
                result.total,
                { page, pageSize },
                (next) => listPath({ ...input.query, page: next, pageSize })
            )
        );
    },
    get: async (ctx, input) =>
        respond(await ctx.classService.getById(input.path.id), ApiResponse.ok)
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
    paths: {
        entity: classPaths.entity,
        list: listPath
    }
};
