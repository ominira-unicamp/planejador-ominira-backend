import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
extendZodWithOpenApi(z);
type ValidationErrorField = {
    path: PropertyKey[];
    message: string;
    details?: Record<string, unknown>;
};
const ErrorCodeSchema = z
    .enum([
        "UNIQUE_VIOLATION",
        "INVALID_TYPE",
        "INVALID_VALUE",
        "FILTER_UNSUPPORTED_ENDPOINT",
        "FILTER_SYNTAX_INVALID",
        "FILTER_FIELD_UNSUPPORTED",
        "FILTER_OPERATOR_UNSUPPORTED",
        "FILTER_VALUE_INVALID",
        "REQUIRED",
        "REFERENCE_NOT_FOUND",
        "ALREADY_EXISTS",
        "REFERENCE_EXISTS"
    ])
    .openapi("ErrorCode");

const ErrorFieldSchema = z
    .object({
        code: ErrorCodeSchema,
        path: z.array(z.string()),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional()
    })
    .openapi("ErrorField");

const ApiErrorSchema = z
    .object({
        message: z.string(), // Mensagem resumida geral
        errors: z.array(ErrorFieldSchema)
    })
    .openapi("ApiError");

export type ErrorFieldType = z.infer<typeof ErrorFieldSchema>;
type ValidationErrorType = z.infer<typeof ApiErrorSchema>;
type ErrorCode = z.infer<typeof ErrorCodeSchema>;

type PathPrefix = ["query" | "path" | "body" | "header", ...string[]] | [];

function zodIssueParams(issue: z.core.$ZodIssue) {
    if (
        !("params" in issue) ||
        !issue.params ||
        typeof issue.params !== "object"
    ) {
        return undefined;
    }
    return issue.params as Record<string, unknown>;
}

// Mapeia código do Zod para nosso ErrorCode
function zodCodeToErrorCode(
    issue: z.core.$ZodIssue
): z.infer<typeof ErrorCodeSchema> {
    switch (issue.code) {
        case "invalid_type":
            return "INVALID_TYPE";
        case "custom":
            return typeof zodIssueParams(issue)?.code === "string"
                ? (zodIssueParams(issue)?.code as z.infer<
                      typeof ErrorCodeSchema
                  >)
                : "INVALID_VALUE";
        default:
            return "INVALID_VALUE";
    }
}

function ZodToApiError(
    zodError: z.ZodError | undefined,
    prefix: PathPrefix = []
): z.infer<typeof ErrorFieldSchema>[] {
    if (!zodError) {
        return [];
    }
    return zodError.issues.map((issue) => {
        const details = zodIssueParams(issue)?.details;
        return {
            code: zodCodeToErrorCode(issue),
            path: [...prefix, ...issue.path.map(String)],
            message: issue.message,
            ...(details && typeof details === "object"
                ? { details: details as Record<string, unknown> }
                : {})
        };
    });
}

const ValidationErrorSchema = ApiErrorSchema;

class ApiError implements ValidationErrorType {
    constructor(
        public errors: ErrorFieldType[] = [],
        public message: string = "Validation error"
    ) {}
    addError(error: ErrorFieldType) {
        this.errors.push(error);
    }
    addErrors(newErrors: ErrorFieldType[]) {
        this.errors.push(...newErrors);
    }
}

export {
    ApiError as ValidationError,
    ValidationErrorSchema,
    ZodToApiError as ZodToApiError
};
export type { ErrorCode, ValidationErrorField, ValidationErrorType };
