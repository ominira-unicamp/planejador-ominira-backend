import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO from "#/modules/schedule/calendar-event/CalendarEvent.contract.js";
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
        ApiResponse.ok(await ctx.calendarEventService.list(input.query)),
    get: async (ctx, input) =>
        respond(
            await ctx.calendarEventService.getById(input.path.id),
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
    paths: { entity: (id: number) => `/calendar-events/${id}` }
};
