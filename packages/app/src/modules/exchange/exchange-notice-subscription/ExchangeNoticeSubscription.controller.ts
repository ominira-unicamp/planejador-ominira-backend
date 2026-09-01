import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/exchange/exchange-notice-subscription/ExchangeNoticeSubscription.contract.js";
import { exchangeNoticeSubscriptionProblemResponses } from "#/modules/exchange/exchange-notice-subscription/ExchangeNoticeSubscription.problems.js";

const { entity: _entity, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(
    exchangeNoticeSubscriptionProblemResponses
);

const actions: Actions = {
    get: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.exchangeNoticeSubscriptionService.get(input.path.sid)
        ),
    patch: async (ctx, input) =>
        respond(
            await ctx.exchangeNoticeSubscriptionService.patch(
                input.path.sid,
                input.body
            ),
            ApiResponse.ok,
            problemInput.body
        )
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);

export default { contracts, router, registry, authRegistry };
