import { type QueryFilterOperator } from "@pomi/api-core";

import type {
    Filter,
    FilterExpression,
    FilterValue
} from "#/queryFilterDefinitions.js";

export type ScalarWhereFilter<T> = {
    equals?: T;
    not?: T;
    in?: T[];
    gt?: T;
    gte?: T;
    lt?: T;
    lte?: T;
};

export type FilterWhereBuilder<TWhere> = (
    expression: FilterExpression
) => TWhere;

type ScalarKind = "enum" | "number" | "string";
type TraversalDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7];
type IgnoredWhereKey = "AND" | "NOT" | "OR";
type StringKeyOfUnion<T> = T extends unknown ? Extract<keyof T, string> : never;
type ValueOfUnion<T, K extends PropertyKey> = T extends unknown
    ? K extends keyof T
        ? T[K]
        : never
    : never;
type ScalarValue<T> = Extract<NonNullable<T>, number | string>;
type ScalarKindOf<T> = [Extract<ScalarValue<T>, number>] extends [never]
    ? [Extract<ScalarValue<T>, string>] extends [never]
        ? never
        : string extends Extract<ScalarValue<T>, string>
          ? "string"
          : "enum"
    : "number";
type WherePath<T, Kind extends ScalarKind, Depth extends number = 7> = [
    Depth
] extends [never]
    ? never
    : T extends readonly unknown[]
      ? never
      : {
            [K in Exclude<StringKeyOfUnion<NonNullable<T>>, IgnoredWhereKey>]: [
                ScalarKindOf<ValueOfUnion<NonNullable<T>, K>>
            ] extends [never]
                ? WherePath<
                      ValueOfUnion<NonNullable<T>, K>,
                      Kind,
                      TraversalDepth[Depth]
                  > extends infer NestedPath
                    ? NestedPath extends string
                        ? `${K}.${NestedPath}`
                        : never
                    : never
                : ScalarKindOf<ValueOfUnion<NonNullable<T>, K>> extends Kind
                  ? K
                  : never;
        }[Exclude<StringKeyOfUnion<NonNullable<T>>, IgnoredWhereKey>];

export type NumberWherePath<TWhere> = WherePath<TWhere, "number">;
export type StringWherePath<TWhere> = WherePath<TWhere, "string">;
export type EnumWherePath<TWhere> = WherePath<TWhere, "enum">;

const forbiddenPathSegments = new Set([
    "__proto__",
    "constructor",
    "prototype"
]);

function whereAt<TWhere, T extends string | number | Date>(
    path: string,
    convert: (value: FilterValue) => T
): FilterWhereBuilder<TWhere> {
    const segments = path.split(".");
    if (
        segments.some(
            (segment) =>
                segment.length === 0 || forbiddenPathSegments.has(segment)
        )
    ) {
        throw new Error(`Invalid Prisma where path: ${path}`);
    }
    return (expression) =>
        segments.reduceRight<unknown>(
            (where, segment) => ({ [segment]: where }),
            scalarFilter(expression.operator, expression.values, convert)
        ) as TWhere;
}

function nestedWhere<TWhere>(path: string, value: unknown): TWhere {
    const segments = path.split(".");
    if (
        segments.some(
            (segment) =>
                segment.length === 0 || forbiddenPathSegments.has(segment)
        )
    ) {
        throw new Error(`Invalid Prisma where path: ${path}`);
    }
    return segments.reduceRight<unknown>(
        (where, segment) => ({ [segment]: where }),
        value
    ) as TWhere;
}

export function containsAt<TWhere>(
    path: StringWherePath<TWhere>
): FilterWhereBuilder<TWhere> {
    return (expression) =>
        nestedWhere<TWhere>(path, {
            contains: String(expression.values[0]),
            mode: "insensitive"
        });
}

export function dateAt<TWhere>(
    path: StringWherePath<TWhere>
): FilterWhereBuilder<TWhere> {
    return whereAt<TWhere, Date>(path, (value) => new Date(String(value)));
}

export function prismaWhereFor<TWhere>() {
    return {
        enumAt(path: EnumWherePath<TWhere>): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, string>(path, String);
        },
        numberAt(path: NumberWherePath<TWhere>): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, number>(path, Number);
        },
        stringAt(path: StringWherePath<TWhere>): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, string>(path, String);
        }
    };
}

export function scalarFilter<T extends string | number | Date>(
    operator: QueryFilterOperator,
    values: FilterValue[],
    convert: (value: FilterValue) => T
): ScalarWhereFilter<T> {
    const converted = values.map(convert);
    switch (operator) {
        case "eq":
            return { equals: converted[0] };
        case "ne":
            return { not: converted[0] };
        case "in":
            return { in: converted };
        case "gt":
            return { gt: converted[0] };
        case "gte":
            return { gte: converted[0] };
        case "lt":
            return { lt: converted[0] };
        case "lte":
            return { lte: converted[0] };
    }
}

export function compileFilterWhere<TWhere>(
    filter: Filter | undefined,
    definitions: Readonly<Record<string, FilterWhereBuilder<TWhere>>>,
    resourceName: string
): TWhere[] {
    return (filter ?? []).map((expression) => {
        const path = expression.path.join(".");
        const builder = definitions[path];
        if (!builder) {
            throw new Error(`Unsupported ${resourceName} filter: ${path}`);
        }
        return builder(expression);
    });
}
