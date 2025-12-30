import { Request, Response } from "express";
import prisma, { MyPrisma } from "./PrismaClient";
import { z } from "zod";
import { ZodToApiError } from "./Validation";
import ResponseBuilder from "./openapi/ResponseBuilder";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";
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
	T extends { findUnique:  (a: any) => any}
>(
	delegate: T,
	prismaClassFieldSelection: Partial<MyPrisma.Args<T, 'findUnique'>>,
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
		} as MyPrisma.Args<T, 'findUnique'>;

		const data = await delegate.findUnique(args);
		if (!data) {
			res.status(404).json({ error: notFoundMessage });
			return;
		}
		res.json(buildClassEntity(data));
	};
}


export {
	defaultOpenApiGetPath,
	defaultGetHandler
};