import { Request, Response } from "express";
import { MyPrisma } from "./PrismaClient.js";
import { z } from "zod";
import { ZodToApiError } from "./Validation.js";
import ResponseBuilder from "./openapi/ResponseBuilder.js";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { buildPaginationResponse, PaginatedResult, PaginatedSchemaType, paginationQuerySchema, PaginationQueryType, prismaPaginationParamsFromQuery } from "./pagination.js";
import { PrismaClient } from "../prisma/generated/client.js";
function defaultOpenApiGetPath(
	path: string,
	tag: string,
	entitySchema: z.ZodTypeAny,
	okMessage: string
) {
	return {
		method: 'get' as RouteConfig["method"],
		path: path,
		tags: [tag],
		request: {
			params: z.object({
				id: z.int(),
			}),
		},
		responses: new ResponseBuilder()
			.ok(entitySchema, okMessage)
			.notFound()
			.badRequest()
			.internalServerError()
			.build(),
	};
}

function defaultGetHandler<
	T extends (prisma :  PrismaClient) => { findUnique: (a: any) => any }
>(
	delegateFn: T,
	prismaClassFieldSelection: Partial<MyPrisma.Args<ReturnType<T>, 'findUnique'>>,
	buildClassEntity: (data: any) => any,
	notFoundMessage = "Not found"
): import("express").RequestHandler {
	return async function get(req, res): Promise<void> {
		const parsed = z.coerce.number().int().safeParse(req.params.id);
		if (!parsed.success) {
			res.status(400).json(ZodToApiError(parsed.error, ["path", "id"]));
			return;
		}
		const id: number = parsed.data;
		
		const args = {
			where: { id },
			...prismaClassFieldSelection,
		} as MyPrisma.Args<ReturnType<T>, 'findUnique'>;
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
	T extends (prisma : PrismaClient) => { findMany: (a: { where: any }) => any; count: (a: {where: any}) => any },
	D extends z.ZodType,
	Q extends z.ZodType<PaginationQueryType>,
> (
	delegateFn: T,
	querySchema: Q,
	whereClauseBuilder: (query: z.infer<Q>) => NonNullable<Parameters<ReturnType<T>['findMany']>[0]>['where'],
	listPath: (query : z.infer<Q>) => string,
	prismaClassFieldSelection: Partial<MyPrisma.Args<ReturnType<T>, 'findUnique'>>,
	buildClassEntity: (data: any) => any
) {
	return async function defaultListHandler(req: Request, res: Response) {

		const { success, data: query, error } = querySchema.safeParse(req.query);
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
			where,
		});
		const entities = entitiesData.map((entity : any) => buildClassEntity(entity));

		const response = buildPaginationResponse(entities, total, query, (page) => {
			return listPath({
				... query,
				page,
			});
		});
		res.json(response);

	}
}


export {
	defaultOpenApiGetPath,
	defaultGetHandler,
	defaultListHandler
};