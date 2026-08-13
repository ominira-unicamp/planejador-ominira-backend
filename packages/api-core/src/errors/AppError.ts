export abstract class AppError extends Error {
    abstract readonly status: number;
    abstract readonly type: string;
    abstract readonly title: string;

    constructor(
        message: string,
        readonly details: unknown[] = []
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class BadRequestError extends AppError {
    readonly status = 400;
    readonly type = "urn:pomi:problem:invalid-request";
    readonly title = "Dados da requisição inválidos";
}

export class UnauthenticatedError extends AppError {
    readonly status = 401;
    readonly type = "urn:pomi:problem:unauthenticated";
    readonly title = "Autenticação necessária";
}

export class ForbiddenError extends AppError {
    readonly status = 403;
    readonly type = "urn:pomi:problem:forbidden";
    readonly title = "Acesso não permitido";
}

export class NotFoundError extends AppError {
    readonly status = 404;
    readonly type = "urn:pomi:problem:resource-not-found";
    readonly title = "Recurso não encontrado";
}

export class ConflictError extends AppError {
    readonly status = 409;
    readonly type = "urn:pomi:problem:conflict";
    readonly title = "Conflito ao concluir a ação";
}
