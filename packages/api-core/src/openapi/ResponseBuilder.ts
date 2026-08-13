import {
    extendZodWithOpenApi,
    ResponseConfig
} from "@asteasolutions/zod-to-openapi";
import {
    ReferenceObject,
    SchemaObject
} from "@asteasolutions/zod-to-openapi/dist/types.js";
import z, { ZodType } from "zod";
import {
    ConflictProblemSchema,
    ForbiddenProblemSchema,
    InternalServerErrorProblemSchema,
    InvalidRequestProblemSchema,
    ResourceNotFoundProblemSchema,
    UnauthenticatedProblemSchema,
    UnprocessableEntityProblemSchema
} from "../errors/ProblemDetails.js";
extendZodWithOpenApi(z);

class ResponseBuilder {
    response: Record<number, ResponseConfig | ReferenceObject> = {};
    internalServerError(): ResponseBuilder {
        this.response[500] = {
            description: "Não foi possível concluir a ação",
            content: {
                "application/problem+json": {
                    schema: InternalServerErrorProblemSchema
                }
            }
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
            description: "Dados da requisição inválidos",
            content: {
                "application/problem+json": {
                    schema: InvalidRequestProblemSchema
                }
            }
        };
        return this;
    }
    notFound(): ResponseBuilder {
        this.response[404] = {
            description: "Recurso não encontrado",
            content: {
                "application/problem+json": {
                    schema: ResourceNotFoundProblemSchema
                }
            }
        };
        return this;
    }
    unauthorized(): ResponseBuilder {
        this.response[401] = {
            description: "Autenticação necessária",
            content: {
                "application/problem+json": {
                    schema: UnauthenticatedProblemSchema
                }
            }
        };
        return this;
    }
    forbidden(): ResponseBuilder {
        this.response[403] = {
            description: "Acesso não permitido",
            content: {
                "application/problem+json": { schema: ForbiddenProblemSchema }
            }
        };
        return this;
    }
    conflict(): ResponseBuilder {
        this.response[409] = {
            description: "Conflito ao concluir a ação",
            content: {
                "application/problem+json": { schema: ConflictProblemSchema }
            }
        };
        return this;
    }
    unprocessableEntity(): ResponseBuilder {
        this.response[422] = {
            description: "Não foi possível concluir a ação",
            content: {
                "application/problem+json": {
                    schema: UnprocessableEntityProblemSchema
                }
            }
        };
        return this;
    }
    problem(
        statusCode: number,
        schema: ZodType<unknown> | SchemaObject | ReferenceObject,
        description: string
    ): ResponseBuilder {
        this.response[statusCode] = {
            description,
            content: {
                "application/problem+json": { schema }
            }
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
