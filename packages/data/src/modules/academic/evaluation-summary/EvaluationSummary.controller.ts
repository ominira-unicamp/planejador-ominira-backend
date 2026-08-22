import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO from "#/modules/academic/evaluation-summary/EvaluationSummary.contract.js";

const {
    professorSummary: _professorSummary,
    courseSummary: _courseSummary,
    pairSummary: _pairSummary,
    ...contracts
} = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});

function pagePath(path: string, page: number, pageSize: number) {
    return `${path}?${new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
    })}`;
}

const professorSummaries: Actions["professorSummaries"] = async (
    ctx,
    input
) => {
    const summaries =
        await ctx.evaluationSummaryService.listProfessorSummaries();
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? Math.max(summaries.length, 1);
    const start = (page - 1) * pageSize;
    return ApiResponse.ok(
        buildPaginationResponse<typeof IO.professorSummary>(
            summaries.slice(start, start + pageSize),
            summaries.length,
            { page, pageSize },
            (pageNumber) =>
                pagePath(
                    "/professors/evaluation-summaries",
                    pageNumber,
                    pageSize
                )
        )
    );
};

const courseSummaries: Actions["courseSummaries"] = async (ctx, input) => {
    const summaries = await ctx.evaluationSummaryService.listCourseSummaries();
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? Math.max(summaries.length, 1);
    const start = (page - 1) * pageSize;
    return ApiResponse.ok(
        buildPaginationResponse<typeof IO.courseSummary>(
            summaries.slice(start, start + pageSize),
            summaries.length,
            { page, pageSize },
            (pageNumber) =>
                pagePath("/courses/evaluation-summaries", pageNumber, pageSize)
        )
    );
};

const pair: Actions["pair"] = async (ctx, input) => {
    return respond(
        await ctx.evaluationSummaryService.getPairSummary(
            input.query.courseId,
            input.query.professorId
        ),
        ApiResponse.ok
    );
};

const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    { professorSummaries, courseSummaries, pair }
);

export default { contracts, router, registry, authRegistry };
