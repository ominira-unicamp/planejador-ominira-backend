import {
    ResourceNotFoundProblem,
    defineProblem,
    problemResponse,
    type ProblemResponseMap
} from "@pomi/api-core";

export const AdminIdentityManagedByCliProblem = defineProblem({
    schemaName: "AdminIdentityManagedByCliProblem",
    typeName: "admin-identity-managed-by-cli",
    title: "Identidade administrada pela linha de comando",
    status: 403,
    extensions: {}
});

export const authUserNotFoundProblem = () =>
    ResourceNotFoundProblem.create({
        detail: "A identidade solicitada não foi encontrada."
    });
export const adminIdentityManagedByCliProblem = () =>
    AdminIdentityManagedByCliProblem.create({
        detail: "Remova a função administrativa pela linha de comando antes de alterar esta identidade."
    });

export type AuthUserProblem =
    | ReturnType<typeof authUserNotFoundProblem>
    | ReturnType<typeof adminIdentityManagedByCliProblem>;
export const authUserProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [AdminIdentityManagedByCliProblem.type]: problemResponse(
        AdminIdentityManagedByCliProblem
    )
} satisfies ProblemResponseMap<AuthUserProblem, object>;
