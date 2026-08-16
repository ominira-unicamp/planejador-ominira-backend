import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, {
    coursePaths,
    type ListQueryParams
} from "#/modules/academic/course/Course.contract.js";
import { courseProblemResponses } from "#/modules/academic/course/Course.problems.js";
import z from "zod";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder(courseProblemResponses);

const list: Actions["list"] = async (ctx, input) => {
    const result = await ctx.courseService.list(input.query);
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? Math.max(result.total, 1);
    return ApiResponse.ok(
        buildPaginationResponse<typeof IO.schema>(
            result.items as Array<z.infer<typeof IO.schema>>,
            result.total,
            { page, pageSize },
            (pageNumber) =>
                listPath({ ...input.query, page: pageNumber, pageSize })
        )
    );
};

const get: Actions["get"] = async (ctx, input) =>
    respond(await ctx.courseService.getById(input.path.id), ApiResponse.ok);

function listPath(query: ListQueryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
    }
    const search = params.toString();
    return `/courses${search ? `?${search}` : ""}`;
}

const actions: Actions = { list, get };
const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    actions
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        list: listPath,
        entity: coursePaths.entity
    }
};
