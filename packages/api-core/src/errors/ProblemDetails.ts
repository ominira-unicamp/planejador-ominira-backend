import z from "zod";

import { AppError } from "./AppError.js";

export const ProblemDetailsSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string().optional(),
    timestamp: z.string().datetime(),
    errors: z.array(z.unknown()).optional()
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export function toProblemDetails(
    error: AppError,
    instance?: string
): ProblemDetails {
    return {
        type: `about:blank#${error.code.toLowerCase().replaceAll("_", "-")}`,
        title: error.name,
        status: error.status,
        detail: error.message,
        instance,
        code: error.code,
        timestamp: new Date().toISOString(),
        errors: error.details.length ? error.details : undefined
    };
}
