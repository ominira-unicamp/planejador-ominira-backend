import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { ValidationError } from "../../Validation.js";

extendZodWithOpenApi(z);

const dateInput = z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .pipe(z.coerce.date());

const tagIdsInput = z
    .union([z.string(), z.array(z.string())])
    .transform((tagIds) => (Array.isArray(tagIds) ? tagIds : [tagIds]))
    .pipe(
        z
            .array(
                z
                    .string()
                    .pipe(z.coerce.number())
                    .pipe(z.number().int().positive())
            )
            .min(1)
            .refine((tagIds) => new Set(tagIds).size === tagIds.length, {
                message: "tagId must not contain duplicates"
            })
    );

export const calendarQuerySchema = z
    .object({
        startDate: dateInput.optional(),
        endDate: dateInput.optional(),
        tagId: tagIdsInput.optional()
    })
    .strict()
    .superRefine((query, context) => {
        if (
            query.startDate &&
            query.endDate &&
            query.startDate > query.endDate
        ) {
            context.addIssue({
                code: "custom",
                path: ["startDate"],
                message: "startDate must be before or equal to endDate"
            });
        }
    })
    .openapi("CalendarFeedQuery");

export type CalendarFeedQuery = z.infer<typeof calendarQuerySchema>;

export function invalidCalendarQuery(error: z.ZodError) {
    return new ValidationError(
        error.issues.map((issue) => ({
            code: "INVALID_VALUE" as const,
            path: ["query", ...issue.path.map(String)],
            message: issue.message
        }))
    );
}
