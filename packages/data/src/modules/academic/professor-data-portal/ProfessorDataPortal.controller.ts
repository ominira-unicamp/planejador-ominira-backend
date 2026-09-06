import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    problemResponse,
    ResourceNotFoundProblem,
    type EndpointActions
} from "@pomi/api-core";
import IO, {
    coauthorSchema,
    keywordSchema,
    profileSummary
} from "./ProfessorDataPortal.contract.js";
const { profile, positions, departments, keywords, coauthors } = IO;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
});
const contracts = {
    profileList: profile.list,
    profileGet: profile.get,
    positionList: positions.list,
    positionGet: positions.get,
    departmentList: departments.list,
    departmentGet: departments.get,
    keywordList: keywords.list,
    keywordGet: keywords.get,
    coauthorList: coauthors.list,
    coauthorGet: coauthors.get
};
type Actions = EndpointActions<typeof contracts, unknown, Context>;
const actions: Actions = {
    profileList: async (ctx, input) => {
        const result = await ctx.professorDataPortalService.listProfiles(
            input.query
        );
        const page = input.query.page ?? 1;
        const pageSize = input.query.pageSize ?? 20;
        return ApiResponse.ok(
            buildPaginationResponse<typeof profileSummary>(
                result.items,
                result.total,
                { page, pageSize },
                () => "/professor-data-portal-profiles"
            )
        );
    },
    profileGet: async (ctx, input) =>
        respond(
            await ctx.professorDataPortalService.getProfile(input.path.id),
            ApiResponse.ok
        ),
    positionList: async (ctx) =>
        ApiResponse.ok(await ctx.professorDataPortalService.listPositions()),
    positionGet: async (ctx, input) =>
        respond(
            await ctx.professorDataPortalService.getPosition(input.path.id),
            ApiResponse.ok
        ),
    departmentList: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.professorDataPortalService.listDepartments(input.query)
        ),
    departmentGet: async (ctx, input) =>
        respond(
            await ctx.professorDataPortalService.getDepartment(input.path.id),
            ApiResponse.ok
        ),
    keywordList: async (ctx, input) => {
        const result = await ctx.professorDataPortalService.listKeywords(
            input.query
        );
        const page = input.query.page ?? 1;
        const pageSize = input.query.pageSize ?? 20;
        return ApiResponse.ok(
            buildPaginationResponse<typeof keywordSchema>(
                result.items,
                result.total,
                { page, pageSize },
                () => "/keywords"
            )
        );
    },
    keywordGet: async (ctx, input) =>
        respond(
            await ctx.professorDataPortalService.getKeyword(input.path.id),
            ApiResponse.ok
        ),
    coauthorList: async (ctx, input) => {
        const result = await ctx.professorDataPortalService.listCoauthors(
            input.query
        );
        const page = input.query.page ?? 1;
        const pageSize = input.query.pageSize ?? 20;
        return ApiResponse.ok(
            buildPaginationResponse<typeof coauthorSchema>(
                result.items,
                result.total,
                { page, pageSize },
                () => "/coauthors"
            )
        );
    },
    coauthorGet: async (ctx, input) =>
        respond(
            await ctx.professorDataPortalService.getCoauthor(input.path.id),
            ApiResponse.ok
        )
};
const { router, registry, authRegistry } = createDataEndpointRegistries(
    contracts,
    actions
);
export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: { profile: (id: number) => `/professor-data-portal-profiles/${id}` }
};
