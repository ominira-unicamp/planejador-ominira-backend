import {
    ApiResponse,
    createResultResponder,
    serializeQueryParams,
    type EndpointActions
} from "@pomi/api-core";

import { createDataEndpointRegistries, type Context } from "#/BuildHandler.js";
import type { AuthorizationPolicy } from "#/auth.js";
import IO, {
    type CurriculumSuggestionEntity,
    type ListCurriculumSuggestionsQuery
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.contract.js";
import { curriculumSuggestionProblemResponses } from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.problems.js";

const { schema: _schema, schemas: _schemas, ...contracts } = IO;
type Actions = EndpointActions<typeof contracts, AuthorizationPolicy, Context>;
const respond = createResultResponder(curriculumSuggestionProblemResponses);

function entityPath(id: number) {
    return `/curriculum-suggestions/${id}`;
}

function listPath(query: Partial<ListCurriculumSuggestionsQuery> = {}) {
    const search = serializeQueryParams(
        query as unknown as Record<string, unknown>
    );
    return `/curriculum-suggestions${search ? `?${search}` : ""}`;
}

function withPaths(
    suggestion: Awaited<
        ReturnType<Context["curriculumSuggestionService"]["list"]>
    >[number]
): CurriculumSuggestionEntity {
    return {
        ...suggestion,
        _paths: {
            self: entityPath(suggestion.id),
            catalogProgram: `/catalog-program/${suggestion.catalogProgramId}`,
            specialization: suggestion.specialization
                ? `/specializations/${suggestion.specialization.id}`
                : null
        }
    };
}

const list: Actions["list"] = async (ctx, input) =>
    ApiResponse.ok(
        (await ctx.curriculumSuggestionService.list(input.query)).map(withPaths)
    );

const get: Actions["get"] = async (ctx, input) =>
    respond(
        await ctx.curriculumSuggestionService.getById(input.path.id),
        (suggestion) => ApiResponse.ok(withPaths(suggestion))
    );

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
        entity: entityPath,
        list: listPath
    }
};
