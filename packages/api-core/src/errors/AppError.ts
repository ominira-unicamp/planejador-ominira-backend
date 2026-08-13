export abstract class AppError extends Error {
    abstract readonly status: number;
    abstract readonly code: string;

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
    readonly code = "BAD_REQUEST";
}

export class UnauthenticatedError extends AppError {
    readonly status = 401;
    readonly code = "UNAUTHENTICATED";
}

export class ForbiddenError extends AppError {
    readonly status = 403;
    readonly code = "FORBIDDEN";
}

export class NotFoundError extends AppError {
    readonly status = 404;
    readonly code = "NOT_FOUND";
}

export class ConflictError extends AppError {
    readonly status = 409;
    readonly code = "CONFLICT";
}
