import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/feedback/feedback-report/FeedbackReport.contract.js";
import { feedbackReportProblemResponses } from "#/modules/feedback/feedback-report/FeedbackReport.problems.js";

const { body: _body, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(feedbackReportProblemResponses);

const createAnonymous: Actions["createAnonymous"] = async (ctx, input) =>
    respond(
        await ctx.feedbackReportService.createAnonymous(
            input.body,
            ctx.requestIp
        ),
        ApiResponse.created,
        problemInput.body
    );

const createForStudent: Actions["createForStudent"] = async (ctx, input) =>
    respond(
        await ctx.feedbackReportService.createForStudent(
            input.path.sid,
            input.body
        ),
        ApiResponse.created,
        problemInput.body
    );

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    { createAnonymous, createForStudent }
);

export default { contracts, router, registry, authRegistry };
