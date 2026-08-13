import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import type z from "zod";

import type { EndpointContract } from "../http/EndpointContract.js";
import { pathSegmentToOpenApiPath } from "../PathSegment.js";
import RequestBuilder from "./RequestBuilder.js";
import ResponseBuilder from "./ResponseBuilder.js";

export function openApiFromEndpoint(
    contract: EndpointContract<unknown>
): RouteConfig {
    let request = new RequestBuilder();
    const shape = contract.request.shape;
    if (shape.path)
        request = request.params(shape.path as z.ZodObject<z.ZodRawShape>);
    if (shape.query)
        request = request.query(shape.query as z.ZodObject<z.ZodRawShape>);
    if (shape.body) {
        request = request.body(
            shape.body,
            shape.body.meta()?.description ?? "Request body"
        );
    }

    const responses = new ResponseBuilder();
    const statuses = new Set<number>();
    for (const variant of contract.response.options) {
        const status = variant.shape.status.value;
        const schema = (
            variant.shape.body as z.ZodOptional<z.ZodType>
        ).unwrap();
        statuses.add(status);
        switch (status) {
            case 200:
                responses.ok(
                    schema,
                    variant.meta()?.description ?? "Successful response"
                );
                break;
            case 201:
                responses.created(
                    schema,
                    variant.meta()?.description ??
                        "Resource created successfully"
                );
                break;
            case 204:
                responses.noContent();
                break;
            case 400:
                responses.badRequest();
                break;
            case 404:
                responses.notFound();
                break;
            case 500:
                responses.internalServerError();
                break;
            default:
                responses.statusCode(
                    status,
                    schema,
                    variant.meta()?.description ?? "Response"
                );
        }
    }
    if (!statuses.has(400)) responses.badRequest();
    if (!statuses.has(500)) responses.internalServerError();

    return {
        method: contract.meta.method,
        path: pathSegmentToOpenApiPath(contract.meta.path),
        tags: contract.meta.tags,
        request: request.build(),
        responses: responses.build()
    };
}
