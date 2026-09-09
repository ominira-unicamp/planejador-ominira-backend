import qs from "qs";
import z from "zod";

export const queryFilterOperators = [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "in"
] as const;

export type QueryFilterOperator = (typeof queryFilterOperators)[number];

export type QueryFilterExpression = {
    path: string[];
    operator: QueryFilterOperator;
    values: string[];
};

export type QueryFilter = QueryFilterExpression[];

type QueryFilterIssue = {
    code: "FILTER_SYNTAX_INVALID";
    path: (string | number)[];
    message: string;
    details?: Record<string, unknown>;
};

type NormalizedQueryFilter =
    | { success: true; data: QueryFilter }
    | { success: false; issues: QueryFilterIssue[] };

const queryFilterOperatorSet = new Set<string>(queryFilterOperators);
const queryFilterLimits = {
    depth: 5,
    expressions: 20,
    parameters: 100,
    path: 3
} as const;

const queryParserOptions = {
    allowPrototypes: false,
    arrayLimit: 20,
    depth: queryFilterLimits.depth,
    parameterLimit: queryFilterLimits.parameters,
    plainObjects: true
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDangerousKey(key: string) {
    return key === "__proto__" || key === "constructor" || key === "prototype";
}

function valueAsString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function valueType(value: unknown) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function normalizeQueryFilterInput(input: unknown): NormalizedQueryFilter {
    const issues: QueryFilterIssue[] = [];
    const expressions: QueryFilterExpression[] = [];

    function addIssue(
        path: (string | number)[],
        message: string,
        details?: Record<string, unknown>
    ) {
        issues.push({
            code: "FILTER_SYNTAX_INVALID",
            path,
            message,
            ...(details ? { details } : {})
        });
    }

    if (!isRecord(input)) {
        addIssue([], "O filtro deve ser um objeto.", {
            expected: "object",
            receivedType: valueType(input)
        });
        return {
            success: false,
            issues
        };
    }

    function visit(value: unknown, path: string[]) {
        if (expressions.length >= queryFilterLimits.expressions) {
            addIssue(
                path,
                `O filtro pode conter no máximo ${queryFilterLimits.expressions} expressões.`,
                {
                    limit: queryFilterLimits.expressions,
                    received: expressions.length + 1
                }
            );
            return;
        }

        if (!isRecord(value)) {
            addIssue(
                path,
                "Os campos do filtro devem ser objetos ou valores escalares.",
                { expected: ["object", "string", "number"] }
            );
            return;
        }

        for (const [key, child] of Object.entries(value)) {
            if (isDangerousKey(key)) {
                addIssue([...path, key], "O filtro contém um campo inválido.", {
                    field: key
                });
                continue;
            }

            if (queryFilterOperatorSet.has(key)) {
                if (path.length === 0) {
                    addIssue(
                        [...path, key],
                        `O operador de filtro "${key}" precisa estar associado a um campo.`,
                        { operator: key }
                    );
                    continue;
                }

                const values = Array.isArray(child) ? child : [child];
                if (key !== "in" && values.length !== 1) {
                    addIssue(
                        [...path, key],
                        `O operador "${key}" aceita exatamente um valor.`,
                        {
                            operator: key,
                            expectedValues: 1,
                            receivedValues: values.length
                        }
                    );
                    continue;
                }

                const normalizedValues = values.map(valueAsString);
                if (normalizedValues.some((item) => item === undefined)) {
                    addIssue(
                        [...path, key],
                        "Os valores do filtro devem ser textos.",
                        {
                            operator: key,
                            receivedTypes: values.map(valueType)
                        }
                    );
                    continue;
                }

                if (normalizedValues.length === 0) {
                    addIssue(
                        [...path, key],
                        "O filtro deve conter pelo menos um valor.",
                        { operator: key, minimumValues: 1 }
                    );
                    continue;
                }

                expressions.push({
                    path,
                    operator: key as QueryFilterOperator,
                    values: normalizedValues as string[]
                });
                continue;
            }

            const nextPath = [...path, key];
            if (nextPath.length > queryFilterLimits.path) {
                addIssue(
                    nextPath,
                    `O caminho do filtro é muito profundo. O limite é de ${queryFilterLimits.path} níveis.`,
                    {
                        maxDepth: queryFilterLimits.path,
                        receivedDepth: nextPath.length
                    }
                );
                continue;
            }

            if (Array.isArray(child)) {
                addIssue(
                    nextPath,
                    'Arrays só são aceitos com o operador "in".',
                    { operator: "in" }
                );
                continue;
            }

            const scalar = valueAsString(child);
            if (scalar !== undefined) {
                expressions.push({
                    path: nextPath,
                    operator: "eq",
                    values: [scalar]
                });
                continue;
            }

            visit(child, nextPath);
        }
    }

    if (Object.keys(input).length === 0) {
        addIssue([], "O filtro deve conter pelo menos uma expressão.", {
            minimumExpressions: 1
        });
    } else {
        visit(input, []);
    }

    return issues.length > 0
        ? { success: false, issues }
        : { success: true, data: expressions };
}

export function parseStructuredQuery(query: string): Record<string, unknown> {
    return qs.parse(query, queryParserOptions) as Record<string, unknown>;
}

export function normalizeQueryFilter(input: unknown): NormalizedQueryFilter {
    return normalizeQueryFilterInput(input);
}

export const queryFilterSchema = z.unknown().transform((input, context) => {
    const result = normalizeQueryFilterInput(input);
    if (result.success) return result.data;

    for (const issue of result.issues) {
        context.addIssue({
            code: "custom",
            path: issue.path,
            message: issue.message,
            params: {
                code: issue.code,
                ...(issue.details ? { details: issue.details } : {})
            }
        });
    }
    return z.NEVER;
});

function queryFilterToObject(filter: QueryFilter) {
    const result: Record<string, unknown> = {};
    const grouped = new Map<string, QueryFilterExpression[]>();

    for (const expression of filter) {
        const key = expression.path.join("\u0000");
        const expressions = grouped.get(key) ?? [];
        expressions.push(expression);
        grouped.set(key, expressions);
    }

    for (const expressions of grouped.values()) {
        const expression = expressions[0];
        if (!expression) continue;
        let current = result;
        for (const segment of expression.path.slice(0, -1)) {
            const existing = current[segment];
            if (!isRecord(existing)) {
                current[segment] = {};
            }
            current = current[segment] as Record<string, unknown>;
        }

        const field = expression.path.at(-1);
        if (!field) continue;
        if (expressions.length === 1 && expression.operator === "eq") {
            current[field] = expression.values[0];
            continue;
        }

        current[field] = Object.fromEntries(
            expressions.map((item) => [
                item.operator,
                item.operator === "in" ? item.values : item.values[0]
            ])
        );
    }

    return result;
}

function isQueryFilter(value: unknown): value is QueryFilter {
    return (
        Array.isArray(value) &&
        value.every(
            (item) =>
                isRecord(item) &&
                Array.isArray(item.path) &&
                typeof item.operator === "string" &&
                Array.isArray(item.values)
        )
    );
}

export function serializeQueryParams(query: Record<string, unknown>) {
    const serializableQuery = { ...query };
    if (isQueryFilter(serializableQuery.filter)) {
        serializableQuery.filter = queryFilterToObject(
            serializableQuery.filter
        );
    }

    return qs.stringify(serializableQuery, {
        arrayFormat: "repeat",
        encode: true,
        skipNulls: true
    });
}

export function unsupportedQueryFilterField(
    query: unknown,
    queryFeatures?: { filter?: boolean }
) {
    if (
        !isRecord(query) ||
        query.filter === undefined ||
        queryFeatures?.filter
    ) {
        return undefined;
    }

    return {
        code: "FILTER_UNSUPPORTED_ENDPOINT",
        path: ["query", "filter"],
        message: "Este endpoint não aceita filtros.",
        details: { feature: "filter" }
    };
}
