import { createAppEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO from "#/modules/social/student-social/StudentSocial.contract.js";
import { studentSocialProblemResponses } from "#/modules/social/student-social/StudentSocial.problems.js";
import {
    ApiResponse,
    createResultResponder,
    problemInput,
    type EndpointActions
} from "@pomi/api-core";

const { schemas: _schemas, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(studentSocialProblemResponses);
const actions: Actions = {
    getProfile: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.getProfile(input.path.sid),
            ApiResponse.ok
        ),
    updateProfile: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.updateProfile(
                input.path.sid,
                input.body
            ),
            ApiResponse.ok,
            problemInput.body
        ),
    listPeople: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.studentSocialService.listPeople(
                input.path.sid,
                input.query
            )
        ),
    getPerson: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.getPerson(
                input.path.sid,
                input.path.publicId
            ),
            ApiResponse.ok
        ),
    listFriendships: async (ctx, input) =>
        ApiResponse.ok(
            await ctx.studentSocialService.listFriendships(
                input.path.sid,
                input.query
            )
        ),
    createFriendship: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.createFriendship(
                input.path.sid,
                input.body.targetPublicId
            ),
            ApiResponse.created,
            problemInput.body
        ),
    acceptFriendship: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.acceptFriendship(
                input.path.sid,
                input.path.id
            ),
            ApiResponse.ok
        ),
    removeFriendship: async (ctx, input) =>
        respond(
            await ctx.studentSocialService.removeFriendship(
                input.path.sid,
                input.path.id
            ),
            () => ApiResponse.noContent()
        )
};
const { router, registry, authRegistry } = createAppEndpointRegistries(
    contracts,
    actions
);
export default {
    contracts,
    router,
    registry,
    authRegistry,
    paths: {
        profile: (studentId: number) => `/student/${studentId}/public-profile`,
        people: (studentId: number) => `/student/${studentId}/people`,
        person: (studentId: number, publicId: string) =>
            `/student/${studentId}/people/${publicId}`,
        friendships: (studentId: number) => `/student/${studentId}/friendships`,
        friendship: (studentId: number, id: number) =>
            `/student/${studentId}/friendships/${id}`
    }
};
