import type { Request, Response } from "express";
import type z from "zod";

import {
    invalidRequestProblem,
    withProblemInstance
} from "../errors/ProblemDetails.js";
import { unsupportedQueryFilterField } from "../queryFilter.js";
import { ZodToApiError } from "../Validation.js";
import type {
    EndpointContract,
    EndpointResponsesSchema,
    ResponseEffect
} from "./EndpointContract.js";
import { sendProblem } from "./problemResponse.js";

export type EndpointAction<
    Contract extends EndpointContract<unknown>,
    Context
> = (
    context: Context,
    request: z.infer<Contract["request"]>
) => Promise<z.infer<Contract["response"]>>;

export function executeEffects(response: Response, effects?: ResponseEffect[]) {
    for (const effect of effects ?? []) {
        if (effect.type === "set-cookie") {
            response.cookie(effect.name, effect.value, effect.options);
        } else {
            response.clearCookie(effect.name, effect.options);
        }
    }
}

export function buildEndpointHandler<
    Authorization,
    Contract extends EndpointContract<Authorization>,
    Context
>(
    contract: Contract,
    action: EndpointAction<Contract, Context>,
    createContext: (request: Request, response: Response) => Context
) {
    return async function endpointHandler(
        request: Request,
        response: Response
    ) {
        const unsupportedFilter = unsupportedQueryFilterField(
            request.query,
            contract.meta.queryFeatures
        );
        if (unsupportedFilter) {
            return sendProblem(
                response,
                invalidRequestProblem([unsupportedFilter], request.path)
            );
        }
        const parsed = contract.request.safeParse({
            query: request.query,
            path: request.params,
            body: request.body,
            headers: request.headers
        });
        if (!parsed.success) {
            return sendProblem(
                response,
                invalidRequestProblem(
                    ZodToApiError(parsed.error, []),
                    request.path
                )
            );
        }

        const result = (await action(
            createContext(request, response),
            parsed.data as z.infer<Contract["request"]>
        )) as z.infer<EndpointResponsesSchema>;
        if (result.status >= 400) {
            return sendProblem(
                response,
                withProblemInstance(
                    result.body as ReturnType<typeof invalidRequestProblem>,
                    request.path
                )
            );
        }
        executeEffects(response, result.effects);
        response.status(result.status);
        if (result.status === 204) return response.send();
        return response.json(result.body);
    };
}
