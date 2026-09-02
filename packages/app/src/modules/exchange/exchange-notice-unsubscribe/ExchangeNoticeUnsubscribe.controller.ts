import { ApiResponse, type EndpointActions } from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/exchange/exchange-notice-unsubscribe/ExchangeNoticeUnsubscribe.contract.js";

const actions: EndpointActions<typeof IO, AuthorizationPolicy, Context> = {
    unsubscribe: async (ctx, input) => {
        await ctx.exchangeNoticeUnsubscribeService.unsubscribe(
            input.query.token
        );
        return ApiResponse.ok({ enabled: false as const });
    }
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    IO,
    actions
);

export default { contracts: IO, router, registry, authRegistry };
