import {
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    problemResponse,
    type ProblemResponseMap
} from "@pomi/api-core";

export const socialNotFoundProblem = (detail: string) =>
    ResourceNotFoundProblem.create({ detail });
export const socialConflictProblem = (detail: string) =>
    UniqueConstraintConflictProblem.create({ detail, fields: [] });
export type StudentSocialProblem =
    | ReturnType<typeof socialNotFoundProblem>
    | ReturnType<typeof socialConflictProblem>;
export const studentSocialProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem
    )
} satisfies ProblemResponseMap<StudentSocialProblem, object>;
