import type { Request, Response } from "express";
import z from "zod";

import type { PathSegment } from "../PathSegment.js";
import { ZodToApiError } from "../Validation.js";
import {
    invalidRequestProblem,
    normalizeProblemResponse
} from "../errors/ProblemDetails.js";
import type {
    EndpointRequestSchema,
    EndpointResponsesSchema,
    HttpMethod
} from "./EndpointContract.js";
import { executeEffects } from "./RequestHandler.js";
import { sendProblem } from "./problemResponse.js";

export type CompatibilityContract = {
    meta: {
        method: HttpMethod;
        path: PathSegment[];
        tags: string[];
        authorization: unknown;
    };
    request: EndpointRequestSchema;
    response: EndpointResponsesSchema;
};

export function isCompatibilityContract(
    value: unknown
): value is CompatibilityContract {
    if (!value || typeof value !== "object") return false;
    return "meta" in value && "request" in value && "response" in value;
}

export type CompatibilityAction<
    Contract extends Pick<CompatibilityContract, "request" | "response">,
    Context
> = (
    context: Context,
    request: z.infer<Contract["request"]>
) => Promise<CompatibilityOutput<Contract["response"]>>;

type ResponseStatus<Response extends EndpointResponsesSchema> =
    z.infer<Response> extends { status: infer Status extends number }
        ? Status
        : never;

export type CompatibilityOutput<Response extends EndpointResponsesSchema> =
    Partial<Record<ResponseStatus<Response>, unknown>> &
        Record<number, unknown>;

export function buildCompatibilityHandler<
    RequestSchema extends EndpointRequestSchema,
    ResponseSchema extends EndpointResponsesSchema,
    Context
>(
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
    action: CompatibilityAction<
        { request: RequestSchema; response: ResponseSchema },
        Context
    >,
    createContext: (request: Request, response: Response) => Context
) {
    return async (httpRequest: Request, response: Response) => {
        const parsed = requestSchema.safeParse({
            query: httpRequest.query,
            path: httpRequest.params,
            body: httpRequest.body,
            headers: httpRequest.headers
        });
        if (!parsed.success) {
            return sendProblem(
                response,
                invalidRequestProblem(
                    ZodToApiError(parsed.error, []),
                    httpRequest.path
                )
            );
        }

        const output = (await action(
            createContext(httpRequest, response),
            parsed.data
        )) as Record<number, unknown>;
        const status = responseSchema.options
            .map((variant) => variant.shape.status.value)
            .find((candidate) => Object.hasOwn(output, candidate));
        if (status === undefined) {
            throw new Error("No status code defined in output schema");
        }

        if (status >= 400) {
            return sendProblem(
                response,
                normalizeProblemResponse(
                    status,
                    output[status],
                    httpRequest.path
                )
            );
        }
        executeEffects(response);
        response.status(status);
        return status === 204 ? response.send() : response.json(output[status]);
    };
}
