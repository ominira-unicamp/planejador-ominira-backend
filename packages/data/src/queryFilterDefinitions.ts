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
    uppercase?: boolean;
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
    code({
        nonEmpty = true,
        uppercase = false,
        operators = codeOperators
    }: CodeOptions = {}) {
        const value = z.string().trim();
        const validated = nonEmpty ? value.min(1) : value;
        return definition(
            uppercase
                ? validated.transform((code) => code.toUpperCase())
                : validated,
            operators,
            {
                ...(nonEmpty ? { minLength: 1 } : {}),
                type: "string"
            }
        );
    },
    date({ operators = equalityOperators }: ScalarOptions = {}) {
        return definition(z.iso.date(), operators, {
            format: "date",
            type: "string"
        });
    },
    dateTime({ operators = equalityOperators }: ScalarOptions = {}) {
        return definition(
            z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
            operators,
            {
                format: "date-time",
                type: "string"
            }
        );
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

const operatorSuggestions: Record<string, string> = {
    ge: "gte",
    le: "lte"
};

type FilterOpenApiMetadata = {
    enum?: unknown[];
    format?: string;
    minLength?: number;
    minimum?: number;
    type?: string;
};

function filterExpectedMetadata(definition: FilterDefinition) {
    const schema = definition.openApi as FilterOpenApiMetadata;
    return {
        ...(schema.type ? { type: schema.type } : {}),
        ...(schema.format ? { format: schema.format } : {}),
        ...(schema.minimum === undefined ? {} : { minimum: schema.minimum }),
        ...(schema.minLength === undefined
            ? {}
            : { minLength: schema.minLength }),
        ...(schema.enum ? { allowedValues: schema.enum } : {})
    };
}

function filterExpectedDescription(definition: FilterDefinition) {
    const expected = filterExpectedMetadata(definition);
    if (expected.allowedValues) {
        return `um dos valores: ${expected.allowedValues.join(", ")}`;
    }
    if (expected.format === "date") {
        return "uma data no formato AAAA-MM-DD";
    }
    if (expected.format === "date-time") {
        return "uma data ou data-hora no formato ISO 8601";
    }
    if (expected.type === "integer" && expected.minimum !== undefined) {
        return `um número inteiro maior ou igual a ${expected.minimum}`;
    }
    if (expected.type === "integer") {
        return "um número inteiro";
    }
    if (expected.type === "string" && expected.minLength !== undefined) {
        return "um texto não vazio";
    }
    if (expected.type === "string") {
        return "um texto";
    }
    return "um valor válido";
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
                const filterPath = filter.path.join(".");
                const field = definitions[filterPath];
                if (!field) {
                    const parentPath = filter.path.slice(0, -1).join(".");
                    const parent = definitions[parentPath];
                    const possibleOperator = filter.path.at(-1) ?? "";
                    const suggestion = operatorSuggestions[possibleOperator];
                    context.addIssue({
                        code: "custom",
                        path: [index, ...filter.path],
                        message: parent
                            ? `O operador "${possibleOperator}" não é aceito para o campo "${parentPath}".${suggestion ? ` Você quis dizer "${suggestion}"?` : ""} Operadores aceitos: ${parent.operators.join(", ")}.`
                            : `O campo "${filterPath}" não é aceito neste endpoint. Campos aceitos: ${Object.keys(definitions).join(", ")}.`,
                        params: {
                            code: parent
                                ? "FILTER_OPERATOR_UNSUPPORTED"
                                : "FILTER_FIELD_UNSUPPORTED",
                            details: parent
                                ? {
                                      resource: resourceName,
                                      field: parentPath,
                                      receivedOperator: possibleOperator,
                                      allowedOperators: parent.operators,
                                      ...(suggestion ? { suggestion } : {})
                                  }
                                : {
                                      resource: resourceName,
                                      field: filterPath,
                                      allowedFields: Object.keys(definitions)
                                  }
                        }
                    });
                    valid = false;
                    continue;
                }

                if (!field.operators.includes(filter.operator)) {
                    context.addIssue({
                        code: "custom",
                        path: [index, ...filter.path, filter.operator],
                        message: `O operador "${filter.operator}" não é aceito para o campo "${filterPath}". Operadores aceitos: ${field.operators.join(", ")}.`,
                        params: {
                            code: "FILTER_OPERATOR_UNSUPPORTED",
                            details: {
                                resource: resourceName,
                                field: filterPath,
                                receivedOperator: filter.operator,
                                allowedOperators: field.operators
                            }
                        }
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
                            message: `O valor informado para o campo "${filterPath}" é inválido. Esperado: ${filterExpectedDescription(field)}.`,
                            params: {
                                code: "FILTER_VALUE_INVALID",
                                details: {
                                    resource: resourceName,
                                    field: filterPath,
                                    operator: filter.operator,
                                    valueIndex,
                                    expected: filterExpectedMetadata(field),
                                    receivedType:
                                        value === null
                                            ? "null"
                                            : Array.isArray(value)
                                              ? "array"
                                              : typeof value
                                }
                            }
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
