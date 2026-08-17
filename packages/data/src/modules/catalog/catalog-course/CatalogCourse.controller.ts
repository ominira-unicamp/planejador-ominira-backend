import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import IO, {
    catalogCoursePaths
} from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";
import z from "zod";

const { schema: _schema, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});

const list: Actions["list"] = async (ctx, input) => {
    const result = await ctx.catalogCourseService.list(input.query);
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? Math.max(result.total, 1);
    return ApiResponse.ok(
        buildPaginationResponse<typeof IO.schema>(
            result.items as Array<z.infer<typeof IO.schema>>,
            result.total,
            { page, pageSize },
            (pageNumber) =>
                catalogCoursePaths.list({
                    ...input.query,
                    page: pageNumber,
                    pageSize
                })
        )
    );
};

const get: Actions["get"] = async (ctx, input) =>
    respond(
        await ctx.catalogCourseService.getById(input.path.id),
        ApiResponse.ok
    );

const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    { list, get }
);

export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: catalogCoursePaths
};
