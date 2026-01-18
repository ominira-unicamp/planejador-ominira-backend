import z, { ZodObject, ZodType } from "zod";
import type { Request, Response } from "express";
import { ValidationError, ValidationErrorSchema, ZodToApiError } from "./Validation.js";
import RequestBuilder from "./openapi/RequestBuilder.js";
import ResponseBuilder from "./openapi/ResponseBuilder.js";

import { PrismaClient } from "../prisma/generated/client.js";
import { buildZodIds } from "./PrismaValidator.js";

export type InputSchemaTypes<PT extends z.ZodType, Q extends z.ZodType, B extends z.ZodType> = z.ZodObject<{
	path?: PT,
	query?: Q,
	body?: B
}>


export type outputSchemaType = z.ZodObject<{
	[key: number]: z.ZodOptional<z.ZodType>
}>;

export type Context = {
	prisma: PrismaClient,
	zodIds: ReturnType<typeof buildZodIds>
}

export type HandlerFn<T extends { input: z.ZodType; output: z.ZodType }> = (ctx: Context, input: z.infer<T["input"]>) => Promise<z.infer<T["output"]>>;
export function buildHandler<PT extends z.ZodType, Q extends z.ZodType, B extends z.ZodType, I extends InputSchemaTypes<PT, Q, B>, O extends outputSchemaType>(inputSchema : I, outputSchema : O,  fn: (ctx: Context, input: z.infer<I>) => Promise<z.infer<O>>) {
	return async function handler(req: Request, res: Response) {
		const { data: input, error, success } = inputSchema.safeParse({
			query: req.query,
			path: req.params,
			body: req.body
		});
		if (!success)
			return res.status(400).json(new ValidationError(ZodToApiError(error, [])));
		const ctx = {
			prisma: req.prisma,
			zodIds: buildZodIds(req.prisma)
		}
		const output = await fn(ctx, input);
		const status = Object.keys(outputSchema.shape).map(k => parseInt(k)).find(statusCode => {
			if (Object.hasOwn(output, statusCode)) {
				return true;
			}
		})
		if (status == undefined) {
			throw new Error("No status code defined in output schema");
		}		
		res.status(status);
		return res.json(output[status] );
	}
}
export class OutputBuilder<A  extends { [key: number]: z.ZodOptional<z.ZodType> } > {
	response: A = {} as A;

	internalServerError(): OutputBuilder<A & { 500: z.ZodOptional<z.ZodType>}> {
		this.response[500] = z.object({
			message: z.string().default("Internal server error")
		}).optional().meta({description: "Internal server error"});
		return this as unknown as OutputBuilder<A & { 500: z.ZodOptional<z.ZodType> }>;
	}
	ok<Z extends ZodType>(schema: Z, description: string): OutputBuilder<A & { 200: z.ZodOptional<Z> }> {
		this.response[200] = schema.optional().meta({description: description});
		return this as unknown as OutputBuilder<A & { 200: z.ZodOptional<Z> }>;
	}
	created<Z extends ZodType>(schema: Z, description: string): OutputBuilder<A & { 201: z.ZodOptional<Z> }> {
		this.response[201] = schema.optional().meta({description: description});
		return this as unknown as OutputBuilder<A & { 201: z.ZodOptional<Z> }>;
	}
	noContent(description?: string): OutputBuilder<A & { 204: z.ZodOptional<z.ZodNull>}> {
		this.response[204] = z.null().optional().openapi({ description: description || "No content", type: "string" });
		return this as unknown as OutputBuilder<A & { 204: z.ZodOptional<z.ZodNull> }>;
	}
	badRequest(): OutputBuilder<A & { 400: z.ZodOptional<typeof ValidationErrorSchema> }> {
		this.response[400] = ValidationErrorSchema.optional().meta({description: "Bad request"})
		return this as unknown as OutputBuilder<A & { 400: z.ZodOptional<typeof ValidationErrorSchema> }>;
	}
	notFound(): OutputBuilder<A & { 404: z.ZodOptional<z.ZodObject<{ description: z.ZodDefault<z.ZodString>; }>> }> {
		this.response[404] = z.object({
			description: z.string().default("Not found")
		}).optional().meta({description: "Not found"});
		return this as unknown as OutputBuilder<A & { 404: z.ZodOptional<z.ZodObject<{ description: z.ZodDefault<z.ZodString>; }>> }>;
	}
	unauthorized(): OutputBuilder<A & { 401: z.ZodOptional<z.ZodString> }> {
		this.response[401] = z.string().length(0).optional().openapi({ description: "Unauthorized - authentication required", type: "string" });
		
		return this as unknown as OutputBuilder<A & { 401: z.ZodOptional<z.ZodString> }>;
	}
	build(): z.ZodObject<A> {
		return z.object(this.response);
	}
	statusCode(statusCode: number, schema: ZodType, description: string): OutputBuilder<A & { [key in typeof statusCode]: ZodType }> {
		this.response[statusCode] = schema.optional().meta({message: description});
		return this as unknown as OutputBuilder<A & { [key in typeof statusCode]: ZodType }>;
	}
}

type openApiArgsFromInputArgs<PT extends z.ZodObject, Q extends z.ZodObject, B extends z.ZodObject> = {

	bodyMessage: string,
}
type IO = {
	input: InputSchemaTypes<ZodObject<any>, ZodObject<any>, ZodObject<any>>,
	output: outputSchemaType
}
export function openApiArgsFromIO(io : IO) {
	
	let request = new RequestBuilder()
	if (io.input.shape.path) {
		request = request.params(io.input.shape.path);
	}
	if (io.input.shape.query) {
		request = request.query(io.input.shape.query);
	}
	if (io.input.shape.body) {
		request = request.body(io.input.shape.body, io.input.shape.body.meta()?.description || "Request body");
	}

	const response = new ResponseBuilder();
	if (!io.output.shape[500]) {
		response.internalServerError();
	}
	if (!io.output.shape[400]) {
		response.badRequest();
	}
	for (const statusCodeStr of Object.keys(io.output.shape)) {
		const statusCode = parseInt(statusCodeStr);
		const schema = io.output.shape[statusCode].unwrap(); 
		switch (statusCode) {
			case 200:
				response.ok(schema, "Successful response");
				break;
			case 201:
				response.created(schema, "Resource created successfully");
				break;
			case 204:
				response.noContent();
				break;
			case 400:
				response.badRequest();
				break;
			case 404:
				response.notFound();
				break;
			case 500:
				response.internalServerError();
				break; 
			default:
				response.statusCode(statusCode, schema, "Response");
		}
	}
	return {
		request: request.build(),
		responses: response.build()
	};
}