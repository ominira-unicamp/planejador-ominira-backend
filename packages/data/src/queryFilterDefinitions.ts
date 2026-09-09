import type { SchemaObject } from "@asteasolutions/zod-to-openapi/dist/types.js";
import {
    queryFilterSchema,
    type QueryFilterExpression,
    type QueryFilterOperator
} from "@pomi/api-core";
import z from "zod";

export type FilterValue = string | number;
export type FilterExpression = Omit<QueryFilterExpression, "values"> & {
    values: FilterValue[];
};
export type Filter = FilterExpression[];

export type FilterDefinition = {
    operators: readonly QueryFilterOperator[];
    value: z.ZodType<FilterValue>;
    openApi: SchemaObject;
};

const equalityOperators = ["eq", "in"] as const;
const codeOperators = ["eq", "ne", "in"] as const;
const comparisonOperators = [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "in"
] as const;

type ScalarOptions = {
    operators?: readonly QueryFilterOperator[];
};

type IntegerOptions = ScalarOptions & {
    minimum?: number;
};

type IdOptions = ScalarOptions & {
    positive?: boolean;
};

type CodeOptions = ScalarOptions & {
    nonEmpty?: boolean;
};

function definition(
    value: z.ZodType<FilterValue>,
    operators: readonly QueryFilterOperator[],
    openApi: SchemaObject
): FilterDefinition {
    return { operators, value, openApi };
}

export const filterDefinition = {
    integer({ minimum, operators = equalityOperators }: IntegerOptions = {}) {
        const value = z.coerce.number().int();
        return definition(
            minimum === undefined ? value : value.min(minimum),
            operators,
            {
                ...(minimum === undefined ? {} : { minimum }),
                type: "integer"
            }
        );
    },
    id({ positive = false, operators = equalityOperators }: IdOptions = {}) {
        return filterDefinition.integer({
            minimum: positive ? 1 : undefined,
            operators
        });
    },
    code({ nonEmpty = true, operators = codeOperators }: CodeOptions = {}) {
        const value = z.string().trim();
        return definition(nonEmpty ? value.min(1) : value, operators, {
            ...(nonEmpty ? { minLength: 1 } : {}),
            type: "string"
        });
    },
    enum<const T extends readonly [string, ...string[]]>(
        values: T,
        operators: readonly QueryFilterOperator[] = equalityOperators
    ) {
        return definition(z.enum(values), operators, {
            enum: [...values],
            type: "string"
        });
    }
};

export { comparisonOperators, equalityOperators };

function filterOpenApiField(definition: FilterDefinition): SchemaObject {
    return {
        oneOf: [
            definition.openApi,
            {
                additionalProperties: false,
                properties: Object.fromEntries(
                    definition.operators.map((operator) => [
                        operator,
                        operator === "in"
                            ? { items: definition.openApi, type: "array" }
                            : definition.openApi
                    ])
                ),
                type: "object"
            }
        ]
    };
}

type ObjectSchema = SchemaObject & {
    properties: Record<string, SchemaObject>;
    type: "object";
};

function objectSchema(): ObjectSchema {
    return {
        additionalProperties: false,
        properties: {},
        type: "object"
    };
}

export function resourceFilterOpenApiSchema(
    definitions: Record<string, FilterDefinition>
): SchemaObject {
    const root = objectSchema();

    for (const [path, definition] of Object.entries(definitions)) {
        const segments = path.split(".");
        const field = segments.pop();
        if (!field) continue;

        let current = root;
        for (const segment of segments) {
            const existing = current.properties[segment];
            if (existing?.type === "object" && "properties" in existing) {
                current = existing as ObjectSchema;
                continue;
            }

            const nested = objectSchema();
            current.properties[segment] = nested;
            current = nested;
        }

        current.properties[field] = filterOpenApiField(definition);
    }

    return root;
}

export function resourceFilterSchema(
    definitions: Record<string, FilterDefinition>,
    resourceName: string,
    description: string,
    example?: unknown
) {
    return queryFilterSchema
        .transform((filters, context) => {
            const result: Filter = [];
            let valid = true;

            for (const [index, filter] of filters.entries()) {
                const field = definitions[filter.path.join(".")];
                if (!field) {
                    context.addIssue({
                        code: "custom",
                        path: [index, ...filter.path],
                        message: `filter field is not supported for ${resourceName}`
                    });
                    valid = false;
                    continue;
                }

                if (!field.operators.includes(filter.operator)) {
                    context.addIssue({
                        code: "custom",
                        path: [index, ...filter.path, filter.operator],
                        message:
                            "filter operator is not supported for this field"
                    });
                    valid = false;
                    continue;
                }

                const values: FilterValue[] = [];
                for (const [valueIndex, value] of filter.values.entries()) {
                    const parsed = field.value.safeParse(value);
                    if (!parsed.success) {
                        context.addIssue({
                            code: "custom",
                            path: [index, ...filter.path, valueIndex],
                            message: "filter value is invalid for this field"
                        });
                        valid = false;
                        continue;
                    }
                    values.push(parsed.data);
                }

                result.push({ ...filter, values });
            }

            return valid ? result : z.NEVER;
        })
        .openapi({
            type: "object",
            additionalProperties: true,
            description,
            example,
            param: {
                explode: true,
                schema: resourceFilterOpenApiSchema(definitions),
                style: "deepObject"
            }
        });
}
