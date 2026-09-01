import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO from "#/modules/exchange/exchange-notice/ExchangeNotice.contract.js";
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
        ApiResponse.ok(await ctx.exchangeNoticeService.list(input.query)),
    get: async (ctx, input) =>
        respond(
            await ctx.exchangeNoticeService.getById(input.path.id),
            ApiResponse.ok
        )
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
        entity: (id: number) => `/exchange-notices/${id}`,
        list: (query?: { placeId?: number }) => {
            if (!query?.placeId) return "/exchange-notices";
            return `/exchange-notices?placeId=${query.placeId}`;
        }
    }
};
