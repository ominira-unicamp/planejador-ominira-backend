import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z, { ZodType } from "zod";
extendZodWithOpenApi(z);
type ValidationErrorField = {
	path: PropertyKey[],
	message: string
}
type ValidationErrorType = {
	message: string,
	errors: ValidationErrorField[]
}
function ZodErrorResponse(pathPrefix: string[], error: z.ZodError): ValidationErrorField[] {
	return error.issues.map((err) => ({
		path: [...pathPrefix, ...err.path],
		message: err.message
	}));
}
const ValidationErrorFieldSchema = z.object({
	message: z.string(),
	path: z.array(z.string()),
});
const ValidationErrorSchema = z.object({
	message: z.string(),
	errors: z.array(ValidationErrorFieldSchema)
}).openapi("ValidationError");

class ValidationError implements ValidationErrorType {
	constructor(public message: string, public errors: ValidationErrorField[] = []) {
	}
	addError(path: PropertyKey[], message: string) {
		this.errors.push({ path, message });
	}
	addErrors(newErrors: ValidationErrorField[]) {
		this.errors.push(...newErrors);
	}

}
type RequestParseResult<A extends ZodType, B extends ZodType, C extends ZodType> = {
	success: true,
	query: z.infer<A>,
	params: z.infer<B>,
	body: z.infer<C>,
	error:  never,
} | {
	success: false,
	query: z.infer<A> | undefined,
	params: z.infer<B> | undefined,
	body: z.infer<C> | undefined,
	error:  ValidationErrorField[],
}
function requestSafeParse<A extends ZodType, B extends ZodType, C extends ZodType>({ querySchema, query, paramsSchema: paramsSchema, params: params, bodySchema, body }: { querySchema?: A, query?: unknown, paramsSchema?: B, params?: unknown, bodySchema?: C, body?: unknown }) :  RequestParseResult<A, B, C> {
	const defauftv = { data: undefined, error: undefined, success: true };
	const validationErrors = []
	const data = {
		query: undefined as  z.infer<A> | undefined ,
		params: undefined as  z.infer<B> | undefined ,
		body: undefined as  z.infer<C> | undefined ,
	}
	if (querySchema) {
		const { data: queryData, error: queryError, success: querySuccess } = querySchema.safeParse(query);
		if (!querySuccess)
			validationErrors.push(...ZodErrorResponse(["query"], queryError));
		else 
			data.query = queryData;

	}
	if (paramsSchema) {
		const { data: paramsData, error: paramsError, success: paramsSuccess } = paramsSchema.safeParse(params);
		if (!paramsSuccess)
			validationErrors.push(...ZodErrorResponse(["params"], paramsError));
		else 
			data.params = paramsData;
		
	}
	if (bodySchema) {
		const { data: bodyData, error: bodyError, success: bodySuccess } = bodySchema.safeParse(body);
		if (!bodySuccess)
			validationErrors.push(...ZodErrorResponse(["body"], bodyError));
		else 
			data.body = bodyData;
	}

	if (validationErrors.length === 0) {
		return {
			success: true,
			query: data.query!,
			params: data.params!,
			body: data.body!,
			error: undefined as never,
		}
	} else {
		return {
			success: false,
			query: data.query,
			params: data.params,
			body: data.body,
			error: validationErrors,
		}
	}
}

export {
	ZodErrorResponse,
	ValidationErrorSchema,
	ValidationError,
	requestSafeParse
}
export type {
	ValidationErrorField,
	ValidationErrorType
}