import type { CookieOptions } from "express";
import z from "zod";

import type { PathSegment } from "../PathSegment.js";

export const HttpMethods = {
    GET: "get",
    POST: "post",
    PUT: "put",
    PATCH: "patch",
    DELETE: "delete"
} as const;

export type HttpMethod = (typeof HttpMethods)[keyof typeof HttpMethods];

export type EndpointRequestSchema = z.ZodObject<{
    path?: z.ZodType;
    query?: z.ZodType;
    body?: z.ZodType;
    headers?: z.ZodType;
}>;

export const responseEffectSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("set-cookie"),
        name: z.string(),
        value: z.string(),
        options: z.custom<CookieOptions>()
    }),
    z.object({
        type: z.literal("clear-cookie"),
        name: z.string(),
        options: z.custom<CookieOptions>()
    })
]);

export type ResponseEffect = z.infer<typeof responseEffectSchema>;

export type ResponseVariant = z.ZodObject<{
    status: z.ZodLiteral<number>;
    body: z.ZodType;
    effects: z.ZodOptional<z.ZodArray<typeof responseEffectSchema>>;
}>;

export type EndpointResponsesSchema = z.ZodDiscriminatedUnion<
    [ResponseVariant, ...ResponseVariant[]],
    "status"
>;

export type EndpointContract<Authorization = unknown> = {
    meta: {
        method: HttpMethod;
        path: PathSegment[];
        tags: string[];
        authorization: Authorization;
    };
    request: EndpointRequestSchema;
    response: EndpointResponsesSchema;
};

export type EndpointRegistry<Authorization = unknown> = Record<
    string,
    EndpointContract<Authorization>
>;
