import type { CookieOptions } from "express";
import z from "zod";

import { ValidationErrorSchema } from "../Validation.js";
import type { ResponseEffect, ResponseVariant } from "./EndpointContract.js";
import { responseEffectSchema } from "./EndpointContract.js";

function responseSchema<Status extends number, Schema extends z.ZodType>(
    status: Status,
    body: Schema,
    description: string
) {
    return z
        .object({
            status: z.literal(status),
            body: body.optional(),
            effects: z.array(responseEffectSchema).optional()
        })
        .meta({ description });
}

export class ResponseSchemaBuilder<Variants extends ResponseVariant[] = []> {
    private readonly variants: ResponseVariant[] = [];

    private add<Variant extends ResponseVariant>(variant: Variant) {
        this.variants.push(variant);
        return this as unknown as ResponseSchemaBuilder<[...Variants, Variant]>;
    }

    ok<Schema extends z.ZodType>(schema: Schema, description: string) {
        return this.add(responseSchema(200, schema, description));
    }

    created<Schema extends z.ZodType>(schema: Schema, description: string) {
        return this.add(responseSchema(201, schema, description));
    }

    noContent(description = "No content") {
        return this.add(responseSchema(204, z.null(), description));
    }

    badRequest() {
        return this.add(
            responseSchema(400, ValidationErrorSchema, "Bad request")
        );
    }

    unauthorized() {
        return this.add(
            responseSchema(
                401,
                z.string().length(0),
                "Unauthorized - authentication required"
            )
        );
    }

    notFound() {
        return this.add(
            responseSchema(
                404,
                z.object({ description: z.string().default("Not found") }),
                "Not found"
            )
        );
    }

    internalServerError() {
        return this.add(
            responseSchema(
                500,
                z.object({
                    message: z.string().default("Internal server error")
                }),
                "Internal server error"
            )
        );
    }

    statusCode<Status extends number, Schema extends z.ZodType>(
        status: Status,
        schema: Schema,
        description: string
    ) {
        return this.status(status, schema, description);
    }

    status<Status extends number, Schema extends z.ZodType>(
        status: Status,
        schema: Schema,
        description: string
    ) {
        return this.add(responseSchema(status, schema, description));
    }

    build(): z.ZodDiscriminatedUnion<
        Variants extends [ResponseVariant, ...ResponseVariant[]]
            ? Variants
            : [ResponseVariant, ...ResponseVariant[]],
        "status"
    > {
        if (this.variants.length === 0) {
            throw new Error("At least one response is required");
        }
        return z.discriminatedUnion("status", [
            this.variants[0],
            ...this.variants.slice(1)
        ] as [
            ResponseVariant,
            ...ResponseVariant[]
        ]) as z.ZodDiscriminatedUnion<
            Variants extends [ResponseVariant, ...ResponseVariant[]]
                ? Variants
                : [ResponseVariant, ...ResponseVariant[]],
            "status"
        >;
    }
}

function result<Status extends number, Body>(
    status: Status,
    body: Body,
    effects?: ResponseEffect[]
) {
    return { status, body, ...(effects ? { effects } : {}) };
}

export const ApiResponse = {
    ok: <Body>(body: Body, effects?: ResponseEffect[]) =>
        result(200 as const, body, effects),
    created: <Body>(body: Body, effects?: ResponseEffect[]) =>
        result(201 as const, body, effects),
    noContent: (effects?: ResponseEffect[]) =>
        result(204 as const, null, effects),
    status: <Status extends number, Body>(
        status: Status,
        body: Body,
        effects?: ResponseEffect[]
    ) => result(status, body, effects)
};

export const ResponseEffects = {
    setCookie(
        name: string,
        value: string,
        options: CookieOptions
    ): ResponseEffect {
        return { type: "set-cookie", name, value, options };
    },
    clearCookie(name: string, options: CookieOptions): ResponseEffect {
        return { type: "clear-cookie", name, options };
    }
};
