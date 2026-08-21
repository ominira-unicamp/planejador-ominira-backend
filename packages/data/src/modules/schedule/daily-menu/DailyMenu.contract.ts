import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("daily-menus")];
const specsBuilder = new SpecBuilder(basePath, ["daily-menus"], "id");
const dateInput = z.iso.date().pipe(z.coerce.date());

const mealSchema = z
    .object({
        id: z.number().int().positive(),
        period: z.enum(["LUNCH", "DINNER"]),
        diet: z.enum(["TRADITIONAL", "VEGAN"]),
        status: z.enum(["AVAILABLE", "NOT_REGISTERED"]),
        mainDish: z.string().nullable(),
        items: z.array(z.string()),
        observations: z.array(z.string()),
        serviceNotes: z.array(z.string())
    })
    .strict()
    .openapi("Meal");

const schema = z
    .object({
        id: z.number().int().positive(),
        date: z.iso.date(),
        meals: z.array(mealSchema),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        _paths: z.object({ self: z.string() }).strict()
    })
    .strict()
    .openapi("DailyMenu");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Daily menu retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const listQuery = z
    .object({
        startDate: dateInput.optional(),
        endDate: dateInput.optional()
    })
    .refine(
        ({ startDate, endDate }) =>
            !startDate || !endDate || startDate <= endDate,
        {
            path: ["endDate"],
            message: "endDate must be greater than or equal to startDate"
        }
    );

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({ query: listQuery }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of daily menus retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

export default { schema, get, list };
