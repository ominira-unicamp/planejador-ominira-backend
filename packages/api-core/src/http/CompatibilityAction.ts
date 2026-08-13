import type { Request, Response } from "express";
import z from "zod";

import type { PathSegment } from "../PathSegment.js";
import { ApiResponse } from "./ApiResponse.js";
import type {
    EndpointRequestSchema,
    EndpointResponsesSchema,
    HttpMethod
} from "./EndpointContract.js";
import { buildEndpointHandler, type EndpointAction } from "./RequestHandler.js";

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

type LegacyOutput<Result> = Result extends {
    status: infer Status extends number;
    body?: infer Body;
}
    ? { [Key in Status]: Body }
    : never;

type DeclaredOutput<Response extends EndpointResponsesSchema> = LegacyOutput<
    z.infer<Response>
>;

export type CompatibilityOutput<Response extends EndpointResponsesSchema> =
    DeclaredOutput<Response>;

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
    const contract = {
        meta: {
            method: "get" as const,
            path: [],
            tags: [],
            authorization: undefined
        },
        request: requestSchema,
        response: responseSchema
    };
    return buildEndpointHandler(
        contract,
        (async (context, request) => {
            const output = (await action(context, request)) as Record<
                number,
                unknown
            >;
            const status = responseSchema.options
                .map((variant) => variant.shape.status.value)
                .find((candidate) => Object.hasOwn(output, candidate));
            if (status === undefined) {
                throw new Error("No status code defined in output schema");
            }
            return ApiResponse.status(status, output[status]);
        }) as EndpointAction<typeof contract, Context>,
        createContext
    );
}
