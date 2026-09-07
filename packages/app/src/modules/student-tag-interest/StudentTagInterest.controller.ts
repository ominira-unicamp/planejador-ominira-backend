import {
    ApiResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/student-tag-interest/StudentTagInterest.contract.js";
import { studentTagInterestProblemResponses } from "#/modules/student-tag-interest/StudentTagInterest.problems.js";

type Actions = EndpointActions<typeof IO, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentTagInterestProblemResponses);

const actions: Actions = {
    list: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.studentTagInterestService.list(input.path.sid)
        ),
    put: async (ctx, input) =>
        respond(
            await ctx.studentTagInterestService.put(
                input.path.sid,
                input.path.tagId
            ),
            () => ApiResponse.noContent()
        ),
    remove: async (ctx, input) => {
        await ctx.studentTagInterestService.remove(
            input.path.sid,
            input.path.tagId
        );
        return ApiResponse.noContent();
    }
};

const { router, registry, authRegistry } = createAppEndpointRegistries(
    IO,
    actions
);

export default { contracts: IO, router, registry, authRegistry };
