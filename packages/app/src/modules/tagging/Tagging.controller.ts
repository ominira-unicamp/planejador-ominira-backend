import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO, { relatedCourse } from "#/modules/tagging/Tagging.contract.js";
import {
    ApiResponse,
    buildPaginationResponse,
    createResultResponder,
    problemInput,
    problemResponse,
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    type EndpointActions
} from "@pomi/api-core";

type Actions = EndpointActions<typeof IO, AuthorizationPolicy, Context>;
const respond = createResultResponder({
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(ReferenceNotFoundProblem),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem
    )
});
const actions: Actions = {
    listCategories: async (ctx) =>
        ApiResponse.ok(await ctx.taggingService.listCategories()),
    getCategory: async (ctx, input) =>
        respond(
            await ctx.taggingService.getCategory(input.path.id),
            ApiResponse.ok
        ),
    listTags: async (ctx, input) =>
        ApiResponse.ok(await ctx.taggingService.listTags(input.query)),
    getTag: async (ctx, input) =>
        respond(await ctx.taggingService.getTag(input.path.id), ApiResponse.ok),
    listCourseTags: async (ctx, input) =>
        respond(
            await ctx.taggingService.listCourseTags(input.path.courseId),
            ApiResponse.ok
        ),
    listTagCourses: async (ctx, input) =>
        respond(
            await ctx.taggingService.listTagCourses(
                input.path.id,
                input.query.page ?? 1,
                input.query.pageSize ?? 20
            ),
            (value) =>
                ApiResponse.ok(
                    buildPaginationResponse<typeof relatedCourse>(
                        value.items,
                        value.total,
                        {
                            page: input.query.page ?? 1,
                            pageSize: input.query.pageSize ?? 20
                        },
                        (page) =>
                            `/tags/${input.path.id}/courses?page=${page}&pageSize=${input.query.pageSize ?? 20}`
                    )
                )
        ),
    createCategory: async (ctx, input) =>
        respond(
            await ctx.taggingService.createCategory(input.body),
            ApiResponse.created,
            problemInput.body
        ),
    updateCategory: async (ctx, input) =>
        respond(
            await ctx.taggingService.updateCategory(input.path.id, input.body),
            ApiResponse.ok,
            problemInput.body
        ),
    deleteCategory: async (ctx, input) =>
        respond(await ctx.taggingService.deleteCategory(input.path.id), () =>
            ApiResponse.noContent()
        ),
    createTag: async (ctx, input) =>
        respond(
            await ctx.taggingService.createTag(input.body),
            ApiResponse.created,
            problemInput.body
        ),
    updateTag: async (ctx, input) =>
        respond(
            await ctx.taggingService.updateTag(input.path.id, input.body),
            ApiResponse.ok,
            problemInput.body
        ),
    deleteTag: async (ctx, input) =>
        respond(await ctx.taggingService.deleteTag(input.path.id), () =>
            ApiResponse.noContent()
        ),
    putCourseTag: async (ctx, input) =>
        respond(
            await ctx.taggingService.putCourseTag(
                input.path.courseId,
                input.path.tagId
            ),
            () => ApiResponse.noContent()
        ),
    deleteCourseTag: async (ctx, input) =>
        respond(
            await ctx.taggingService.deleteCourseTag(
                input.path.courseId,
                input.path.tagId
            ),
            () => ApiResponse.noContent()
        )
};
const { router, registry, authRegistry } = createAppEndpointRegistries(
    IO,
    actions
);
export default { contracts: IO, router, registry, authRegistry };
