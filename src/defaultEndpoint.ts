import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "../prisma/generated/client.js";
import { MyPrisma } from "./PrismaClient.js";
import { ZodToApiError } from "./Validation.js";
import ResponseBuilder from "./openapi/ResponseBuilder.js";
import {
    buildPaginationResponse,
    PaginationQueryType,
    prismaPaginationParamsFromQuery
} from "./pagination.js";
function defaultOpenApiGetPath(
    path: string,
    tag: string,
    entitySchema: z.ZodTypeAny,
    okMessage: string
) {
    return {
        method: "get" as RouteConfig["method"],
        path: path,
        tags: [tag],
        request: {
            params: z.object({
                id: z.int()
            })
        },
        responses: new ResponseBuilder()
            .ok(entitySchema, okMessage)
            .notFound()
            .badRequest()
            .internalServerError()
            .build()
    };
}

function defaultGetHandler<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends (prisma: PrismaClient) => { findUnique: (a: any) => unknown }
>(
    delegateFn: T,
    prismaClassFieldSelection: Partial<
        MyPrisma.Args<ReturnType<T>, "findUnique">
    >,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildClassEntity: (data: any) => unknown,
    notFoundMessage = "Not found"
): import("express").RequestHandler {
    return async function get(req: Request, res: Response): Promise<void> {
        const parsed = z.coerce.number().int().safeParse(req.params.id);
        if (!parsed.success) {
            res.status(400).json(ZodToApiError(parsed.error, ["path", "id"]));
            return;
        }
        const id: number = parsed.data;

        const args = {
            where: { id },
            ...prismaClassFieldSelection
        } as MyPrisma.Args<ReturnType<T>, "findUnique">;
        const delegate = delegateFn(req.prisma);
        const data = await delegate.findUnique(args);
        if (!data) {
            res.status(404).json({ error: notFoundMessage });
            return;
        }
        res.json(buildClassEntity(data));
    };
}

function defaultListHandler<
    T extends (prisma: PrismaClient) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: (a: { where: any }) => Promise<any[]>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        count: (a: { where: any }) => Promise<number>;
    },
    Q extends z.ZodType<PaginationQueryType>
>(
    delegateFn: T,
    querySchema: Q,
    whereClauseBuilder: (
        query: z.infer<Q>
    ) => NonNullable<Parameters<ReturnType<T>["findMany"]>[0]>["where"],
    listPath: (query: z.infer<Q>) => string,
    prismaClassFieldSelection: Partial<
        MyPrisma.Args<ReturnType<T>, "findUnique">
    >,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildClassEntity: (data: any) => any
) {
    return async function defaultListHandler(req: Request, res: Response) {
        const {
            success,
            data: query,
            error
        } = querySchema.safeParse(req.query);
        if (!success) {
            res.status(400).json(ZodToApiError(error, ["query"]));
            return;
        }
        const where = whereClauseBuilder(query);
        const delegate = delegateFn(req.prisma);
        const total = await delegate.count({ where });
        const entitiesData = await delegate.findMany({
            ...prismaPaginationParamsFromQuery(query),
            ...prismaClassFieldSelection,
            where
        });
        const entities = entitiesData.map((entity) => buildClassEntity(entity));

        const response = buildPaginationResponse(
            entities,
            total,
            query,
            (page) => {
                return listPath({
                    ...query,
                    page
                });
            }
        );
        res.json(response);
    };
}

export { defaultGetHandler, defaultListHandler, defaultOpenApiGetPath };
