import {
    extendZodWithOpenApi,
    ResponseConfig
} from "@asteasolutions/zod-to-openapi";
import {
    ReferenceObject,
    SchemaObject
} from "@asteasolutions/zod-to-openapi/dist/types.js";
import z, { ZodType } from "zod";
import { ValidationErrorSchema } from "../Validation.js";
extendZodWithOpenApi(z);

class ResponseBuilder {
    response: Record<number, ResponseConfig | ReferenceObject> = {};
    internalServerError(): ResponseBuilder {
        this.response[500] = {
            description: "Internal server error"
        };
        return this;
    }
    ok(
        schema: ZodType<unknown> | SchemaObject | ReferenceObject,
        description: string
    ): ResponseBuilder {
        this.response[200] = {
            description: description,
            content: {
                "application/json": {
                    schema: schema
                }
            }
        };
        return this;
    }
    created(
        schema: ZodType<unknown> | SchemaObject | ReferenceObject,
        description: string
    ): ResponseBuilder {
        this.response[201] = {
            description: description,
            content: {
                "application/json": {
                    schema: schema
                }
            }
        };
        return this;
    }
    noContent(): ResponseBuilder {
        this.response[204] = {
            description: "No content"
        };
        return this;
    }
    badRequest(): ResponseBuilder {
        this.response[400] = {
            description: "Bad request",
            content: {
                "application/json": {
                    schema: ValidationErrorSchema
                }
            }
        };
        return this;
    }
    notFound(): ResponseBuilder {
        this.response[404] = {
            description: "Not found"
        };
        return this;
    }
    unauthorized(): ResponseBuilder {
        this.response[401] = {
            description: "Unauthorized - authentication required"
        };
        return this;
    }
    build(): Record<number, ResponseConfig | ReferenceObject> {
        return this.response;
    }
    statusCode(
        statusCode: number,
        schema: ZodType<unknown> | SchemaObject | ReferenceObject,
        description: string
    ): ResponseBuilder {
        this.response[statusCode] = {
            description: description,
            content: {
                "application/json": {
                    schema: schema
                }
            }
        };
        return this;
    }
}

export default ResponseBuilder;
