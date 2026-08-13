import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { AppError } from "./AppError.js";

extendZodWithOpenApi(z);

export const problemType = (name: string) =>
    `urn:pomi:problem:${name}` as const;

export const ProblemFieldSchema = z
    .object({
        code: z.string(),
        path: z.array(z.string()),
        message: z.string()
    })
    .strict()
    .openapi("ProblemField");

export const ProblemDetailsSchema = z
    .object({
        type: z.string(),
        title: z.string(),
        status: z.number().int(),
        detail: z.string(),
        instance: z.string().optional()
    })
    .strict()
    .openapi("ProblemDetails");

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
export type ProblemField = z.infer<typeof ProblemFieldSchema>;

export function appErrorProblem(
    error: AppError,
    instance?: string
): ProblemDetails {
    return {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.message,
        ...(instance ? { instance } : {})
    };
}

export const InvalidRequestProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("invalid-request")),
    title: z.literal("Dados da requisição inválidos"),
    status: z.literal(400),
    fields: z.array(ProblemFieldSchema)
})
    .strict()
    .openapi("InvalidRequestProblem");

export const MalformedJsonProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("malformed-json")),
    title: z.literal("JSON inválido"),
    status: z.literal(400)
})
    .strict()
    .openapi("MalformedJsonProblem");

export const UnauthenticatedProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("unauthenticated")),
    title: z.literal("Autenticação necessária"),
    status: z.literal(401)
})
    .strict()
    .openapi("UnauthenticatedProblem");

export const ForbiddenProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("forbidden")),
    title: z.literal("Acesso não permitido"),
    status: z.literal(403)
})
    .strict()
    .openapi("ForbiddenProblem");

export const ResourceNotFoundProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("resource-not-found")),
    title: z.literal("Recurso não encontrado"),
    status: z.literal(404)
})
    .strict()
    .openapi("ResourceNotFoundProblem");

export const ConflictProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("conflict")),
    title: z.literal("Conflito ao concluir a ação"),
    status: z.literal(409)
})
    .strict()
    .openapi("ConflictProblem");

export const UnprocessableEntityProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("unprocessable-entity")),
    title: z.literal("Não foi possível concluir a ação"),
    status: z.literal(422),
    fields: z.array(ProblemFieldSchema).optional()
})
    .strict()
    .openapi("UnprocessableEntityProblem");

export const PayloadTooLargeProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("payload-too-large")),
    title: z.literal("Resposta muito grande"),
    status: z.literal(413)
})
    .strict()
    .openapi("PayloadTooLargeProblem");

export const ServiceUnavailableProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("service-unavailable")),
    title: z.literal("Serviço indisponível"),
    status: z.literal(503)
})
    .strict()
    .openapi("ServiceUnavailableProblem");

export const InternalServerErrorProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("internal-server-error")),
    title: z.literal("Não foi possível concluir a ação"),
    status: z.literal(500)
})
    .strict()
    .openapi("InternalServerErrorProblem");

type ProblemInput = Omit<ProblemDetails, "instance"> & { instance?: string };

export function withProblemInstance<T extends ProblemInput>(
    problem: T,
    instance?: string
): T {
    return instance && !problem.instance ? { ...problem, instance } : problem;
}

export function invalidRequestProblem(
    fields: ProblemField[],
    instance?: string
): z.infer<typeof InvalidRequestProblemSchema> {
    return {
        type: problemType("invalid-request"),
        title: "Dados da requisição inválidos",
        status: 400,
        detail: "Revise os campos informados e tente novamente.",
        ...(instance ? { instance } : {}),
        fields
    };
}

export function malformedJsonProblem(instance?: string) {
    return {
        type: problemType("malformed-json"),
        title: "JSON inválido",
        status: 400,
        detail: "O corpo da requisição não contém um JSON válido.",
        ...(instance ? { instance } : {})
    } as z.infer<typeof MalformedJsonProblemSchema>;
}

export function unauthenticatedProblem(instance?: string) {
    return {
        type: problemType("unauthenticated"),
        title: "Autenticação necessária",
        status: 401,
        detail: "Faça login para acessar este recurso.",
        ...(instance ? { instance } : {})
    } as z.infer<typeof UnauthenticatedProblemSchema>;
}

export function forbiddenProblem(instance?: string) {
    return {
        type: problemType("forbidden"),
        title: "Acesso não permitido",
        status: 403,
        detail: "Você não possui permissão para realizar esta ação.",
        ...(instance ? { instance } : {})
    } as z.infer<typeof ForbiddenProblemSchema>;
}

export function resourceNotFoundProblem(detail: string, instance?: string) {
    return {
        type: problemType("resource-not-found"),
        title: "Recurso não encontrado",
        status: 404,
        detail,
        ...(instance ? { instance } : {})
    } as z.infer<typeof ResourceNotFoundProblemSchema>;
}

export function conflictProblem(detail: string, instance?: string) {
    return {
        type: problemType("conflict"),
        title: "Conflito ao concluir a ação",
        status: 409,
        detail,
        ...(instance ? { instance } : {})
    } as z.infer<typeof ConflictProblemSchema>;
}

export function unprocessableEntityProblem(
    detail: string,
    fields?: ProblemField[],
    instance?: string
) {
    return {
        type: problemType("unprocessable-entity"),
        title: "Não foi possível concluir a ação",
        status: 422,
        detail,
        ...(instance ? { instance } : {}),
        ...(fields?.length ? { fields } : {})
    } as z.infer<typeof UnprocessableEntityProblemSchema>;
}

export function serviceUnavailableProblem(detail: string, instance?: string) {
    return {
        type: problemType("service-unavailable"),
        title: "Serviço indisponível",
        status: 503,
        detail,
        ...(instance ? { instance } : {})
    } as z.infer<typeof ServiceUnavailableProblemSchema>;
}

export function internalServerErrorProblem(instance?: string) {
    return {
        type: problemType("internal-server-error"),
        title: "Não foi possível concluir a ação",
        status: 500,
        detail: "Tente novamente em alguns instantes.",
        ...(instance ? { instance } : {})
    } as z.infer<typeof InternalServerErrorProblemSchema>;
}

export function normalizeProblemResponse(
    status: number,
    body: unknown,
    instance?: string
): ProblemDetails {
    if (
        body &&
        typeof body === "object" &&
        "type" in body &&
        "title" in body &&
        "status" in body &&
        "detail" in body
    ) {
        return withProblemInstance(body as ProblemDetails, instance);
    }

    if (
        status === 400 &&
        body &&
        typeof body === "object" &&
        "errors" in body
    ) {
        const legacy = body as { errors?: ProblemField[] };
        return invalidRequestProblem(legacy.errors ?? [], instance);
    }

    switch (status) {
        case 400:
            return invalidRequestProblem([], instance);
        case 401:
            return unauthenticatedProblem(instance);
        case 403:
            return forbiddenProblem(instance);
        case 404:
            return resourceNotFoundProblem(
                "O recurso solicitado não foi encontrado.",
                instance
            );
        case 409:
            return conflictProblem(
                "A ação não pôde ser concluída porque há um conflito.",
                instance
            );
        case 422:
            return unprocessableEntityProblem(
                "Não foi possível concluir a ação com as informações fornecidas.",
                undefined,
                instance
            );
        case 503:
            return serviceUnavailableProblem(
                "O serviço está temporariamente indisponível.",
                instance
            );
        case 500:
            return internalServerErrorProblem(instance);
        default:
            return {
                type: problemType("internal-server-error"),
                title: "Não foi possível concluir a ação",
                status: 500,
                detail: "Tente novamente em alguns instantes.",
                ...(instance ? { instance } : {})
            };
    }
}
