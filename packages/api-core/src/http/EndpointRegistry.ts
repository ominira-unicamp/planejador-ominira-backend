import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { Request, Response } from "express";
import { Router } from "express";

import { openApiFromEndpoint } from "../openapi/EndpointOpenApi.js";
import { pathSegmentToExpressPath } from "../PathSegment.js";
import type { EndpointContract, EndpointRegistry } from "./EndpointContract.js";
import { buildEndpointHandler, type EndpointAction } from "./RequestHandler.js";

export type EndpointActions<
    Contracts extends EndpointRegistry<Authorization>,
    Authorization,
    Context
> = {
    [Key in keyof Contracts]: EndpointAction<Contracts[Key], Context>;
};

export function createEndpointRegistries<
    Authorization,
    Context,
    Contracts extends EndpointRegistry<Authorization>
>(options: {
    contracts: Contracts;
    actions: EndpointActions<Contracts, Authorization, Context>;
    createContext(request: Request, response: Response): Context;
    registerAuthorization(
        method: Uppercase<EndpointContract<Authorization>["meta"]["method"]>,
        path: string,
        authorization: Authorization
    ): void;
}) {
    const router = Router();
    const openApiRegistry = new OpenAPIRegistry();

    for (const [name, contract] of Object.entries(options.contracts)) {
        const action = options.actions[name];
        if (!action) throw new Error(`Missing action for endpoint ${name}`);
        const path = pathSegmentToExpressPath(contract.meta.path);
        router[contract.meta.method](
            path,
            buildEndpointHandler(
                contract,
                action as EndpointAction<typeof contract, Context>,
                options.createContext
            )
        );
        openApiRegistry.registerPath(openApiFromEndpoint(contract));
        options.registerAuthorization(
            contract.meta.method.toUpperCase() as Uppercase<
                typeof contract.meta.method
            >,
            path,
            contract.meta.authorization
        );
    }

    return { router, openApiRegistry };
}
