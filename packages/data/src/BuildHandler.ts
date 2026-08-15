import { buildZodIds } from "#/PrismaValidator.js";
import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import type { CatalogProgramService } from "#/modules/catalog/services/CatalogProgramService.js";
import type { ClassScheduleService } from "#/modules/schedule/services/ClassScheduleService.js";
import {
    buildCompatibilityHandler,
    createEndpointRegistries,
    openApiFromEndpoint,
    ResponseSchemaBuilder,
    type CompatibilityAction,
    type CompatibilityContract,
    type EndpointActions,
    type EndpointRegistry
} from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";

export type Context = {
    prisma: PrismaClient;
    zodIds: ReturnType<typeof buildZodIds>;
    catalogProgramService: CatalogProgramService;
    classScheduleService: ClassScheduleService;
};

export type HandlerFn<
    T extends Pick<CompatibilityContract, "request" | "response">
> = CompatibilityAction<T, Context>;

export const OutputBuilder = ResponseSchemaBuilder;
export type IO = CompatibilityContract;

export function buildHandler<
    RequestSchema extends CompatibilityContract["request"],
    ResponseSchema extends CompatibilityContract["response"]
>(
    request: RequestSchema,
    response: ResponseSchema,
    action: CompatibilityAction<
        {
            request: RequestSchema;
            response: ResponseSchema;
        },
        Context
    >
) {
    return buildCompatibilityHandler(request, response, action, (req) => ({
        prisma: req.scope.cradle.prisma,
        zodIds: req.scope.cradle.zodIds,
        catalogProgramService: req.scope.cradle.catalogProgramService,
        classScheduleService: req.scope.cradle.classScheduleService
    }));
}

export function openApiArgsFromIO(contract: IO) {
    return openApiFromEndpoint(contract);
}

export function createDataEndpointRegistries<
    Contracts extends EndpointRegistry<AuthorizationPolicy>
>(
    contracts: Contracts,
    actions: EndpointActions<Contracts, AuthorizationPolicy, Context>
) {
    const authRegistry = new AuthRegistry();
    const { router, openApiRegistry } = createEndpointRegistries({
        contracts,
        actions,
        createContext: (request) => ({
            prisma: request.scope.cradle.prisma,
            zodIds: request.scope.cradle.zodIds,
            catalogProgramService: request.scope.cradle.catalogProgramService,
            classScheduleService: request.scope.cradle.classScheduleService
        }),
        registerAuthorization: (method, path, authorization) =>
            authRegistry.addPolicy(method, path, authorization)
    });
    return { router, registry: openApiRegistry, authRegistry };
}
