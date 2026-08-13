import { buildZodIds } from "#/PrismaValidator.js";
import {
    buildCompatibilityHandler,
    openApiFromEndpoint,
    ResponseSchemaBuilder,
    type CompatibilityAction,
    type CompatibilityContract
} from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";

export type Context = {
    prisma: PrismaClient;
    zodIds: ReturnType<typeof buildZodIds>;
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
        zodIds: req.scope.cradle.zodIds
    }));
}

export function openApiArgsFromIO(contract: IO) {
    return openApiFromEndpoint(contract);
}
