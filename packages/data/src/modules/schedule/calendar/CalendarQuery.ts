import {
    filterDefinition,
    resourceFilterSchema,
    type Filter
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { ValidationError } from "@pomi/api-core";

extendZodWithOpenApi(z);

export type CalendarFilter = Filter;
const calendarFilterDefinitions = {
    startDate: filterDefinition.dateTime(),
    endDate: filterDefinition.dateTime(),
    tagId: filterDefinition.id()
};

export const calendarQuerySchema = resourceFilterSchema(
    calendarFilterDefinitions,
    "calendar feed",
    "Structured calendar feed filters. Use bracket notation such as filter[tagId]=1."
).openapi("CalendarFeedQuery");

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
