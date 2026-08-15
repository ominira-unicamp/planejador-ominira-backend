import {
    problemDetails,
    type DomainProblem,
    type ProblemDefinition
} from "../errors/ProblemDetails.js";
import type { Result } from "../Result.js";
import { ApiResponse } from "./ApiResponse.js";

export type ProblemResponseContext = {
    instance?: string;
    inputLocation?: "body" | "query" | "path" | "headers";
};

export const problemInput = {
    body: { inputLocation: "body" },
    query: { inputLocation: "query" },
    path: { inputLocation: "path" },
    headers: { inputLocation: "headers" }
} as const satisfies Record<string, ProblemResponseContext>;

export type ProblemResponseMap<Error extends DomainProblem, Context> = {
    [Type in Error["type"]]: (
        error: Extract<Error, { type: Type }>,
        context: Context
    ) => unknown;
};

type ProblemResponse<
    Error extends DomainProblem,
    Context,
    Responses extends ProblemResponseMap<Error, Context>
> = ReturnType<Responses[Error["type"]]>;

export function resultToApiResponse<
    Value,
    Error extends DomainProblem,
    const Context,
    Success,
    Responses extends ProblemResponseMap<Error, Context>
>(
    result: Result<Value, Error>,
    success: (value: Value) => Success,
    problems: Responses,
    context: Context
): Success | ProblemResponse<Error, Context, Responses> {
    return result.match(success, (error) => {
        const response = problems[error.type as Error["type"]] as unknown as (
            problem: Error,
            responseContext: Context
        ) => ProblemResponse<Error, Context, Responses>;
        return response(error, context);
    });
}

export function problemResponse<
    Problem extends DomainProblem,
    Status extends number,
    Schema extends import("zod").ZodType,
    Context extends ProblemResponseContext = ProblemResponseContext
>(
    definition: ProblemDefinition<Problem, Status, Schema>,
    translate?: (problem: Problem, context: Context) => Problem
) {
    return (problem: Problem, context: Context) =>
        ApiResponse.status(
            definition.status,
            problemDetails(
                translate ? translate(problem, context) : problem,
                definition.status,
                context.instance
            )
        );
}

type ResponseForError<
    Responses extends object,
    Error extends DomainProblem
> = ReturnType<
    Extract<
        Responses[Error["type"] & keyof Responses],
        (...args: never[]) => unknown
    >
>;

export function createResultResponder<Responses extends object>(
    problems: Responses
) {
    return function respond<Value, Error extends DomainProblem, Success>(
        result: Error["type"] extends keyof Responses
            ? Result<Value, Error>
            : never,
        success: (value: Value) => Success,
        context: ProblemResponseContext = {}
    ): Success | ResponseForError<Responses, Error> {
        return result.match(success, (error) => {
            const response = (problems as Record<string, unknown>)[
                error.type
            ] as (
                problem: Error,
                responseContext: ProblemResponseContext
            ) => ResponseForError<Responses, Error>;
            return response(error, context);
        });
    };
}
