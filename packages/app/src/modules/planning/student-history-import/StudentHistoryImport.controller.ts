import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/planning/student-history-import/StudentHistoryImport.contract.js";
import { studentHistoryImportProblemResponses } from "#/modules/planning/student-history-import/StudentHistoryImport.problems.js";
import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

const { body: _body, summary: _summary, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentHistoryImportProblemResponses);

const importHistory: Actions["importHistory"] = async (ctx, input) =>
    respond(
        await ctx.studentHistoryImportService.import(
            input.path.sid,
            input.body
        ),
        ApiResponse.ok,
        problemInput.body
    );

const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    { importHistory }
);

export default { contracts, router, registry, authRegistry };
