import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, {
    studyPeriodPaths
} from "#/modules/schedule/study-period/StudyPeriod.contract.js";
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
    list: async (ctx) => ApiResponse.ok(await ctx.studyPeriodService.list()),
    get: async (ctx, input) =>
        respond(
            await ctx.studyPeriodService.getById(input.path.id),
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
    paths: { entity: studyPeriodPaths.entity }
};
