import type { Request, Response } from "express";
import type z from "zod";

import { ValidationError, ZodToApiError } from "../Validation.js";
import type {
    EndpointContract,
    EndpointResponsesSchema,
    ResponseEffect
} from "./EndpointContract.js";

export type EndpointAction<
    Contract extends EndpointContract<unknown>,
    Context
> = (
    context: Context,
    request: z.infer<Contract["request"]>
) => Promise<z.infer<Contract["response"]>>;

function executeEffects(response: Response, effects?: ResponseEffect[]) {
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
        const parsed = contract.request.safeParse({
            query: request.query,
            path: request.params,
            body: request.body,
            headers: request.headers
        });
        if (!parsed.success) {
            return response
                .status(400)
                .json(new ValidationError(ZodToApiError(parsed.error, [])));
        }

        const result = (await action(
            createContext(request, response),
            parsed.data as z.infer<Contract["request"]>
        )) as z.infer<EndpointResponsesSchema>;
        executeEffects(response, result.effects);
        response.status(result.status);
        if (result.status === 204) return response.send();
        return response.json(result.body);
    };
}
