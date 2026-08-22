import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/professor-evaluation/ProfessorEvaluation.contract.js";
import { professorEvaluationProblemResponses } from "#/modules/planning/professor-evaluation/ProfessorEvaluation.problems.js";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(professorEvaluationProblemResponses);

const get: Actions["get"] = async (ctx, input) =>
    respond(
        await ctx.professorEvaluationService.get({
            studentId: input.path.sid,
            classId: input.path.classId,
            professorId: input.path.professorId
        }),
        ApiResponse.ok
    );

const put: Actions["put"] = async (ctx, input) =>
    respond(
        await ctx.professorEvaluationService.put(
            {
                studentId: input.path.sid,
                classId: input.path.classId,
                professorId: input.path.professorId
            },
            input.body
        ),
        ApiResponse.ok,
        problemInput.body
    );

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    { get, put }
);

export default { contracts, router, registry, authRegistry };
