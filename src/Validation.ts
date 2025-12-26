import z from "zod";

type ValidationError = {
	path: PropertyKey[],
	message: string
}
function ZodErrorResponse(pathPrefix: string[], error: z.ZodError): ValidationError[] {
	return error.issues.map((err) => ({
		path: [...pathPrefix, ...err.path],
		message: err.message
	}));
}


export {
	ZodErrorResponse,
}
export type {
	ValidationError
}