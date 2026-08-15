import { createAppEndpointRegistries } from "#/BuildHandler.js";
import IO from "#/modules/planning/period-plan/PeriodPlan.contract.js";
import { periodPlanActions } from "#/modules/planning/period-plan/PeriodPlan.controller.js";

const { router, registry, authRegistry } = createAppEndpointRegistries(
    IO.aliases,
    periodPlanActions
);

export default {
    contracts: IO.aliases,
    router,
    registry,
    authRegistry
};
