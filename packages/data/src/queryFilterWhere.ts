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

type ScalarKind = "date" | "enum" | "number" | "string";
type IgnoredWhereKey = "AND" | "NOT" | "OR";
type StringKeyOfUnion<T> = T extends unknown ? Extract<keyof T, string> : never;
type ValueOfUnion<T, K extends PropertyKey> = T extends unknown
    ? K extends keyof T
        ? T[K]
        : never
    : never;
type ScalarValue<T> = Extract<NonNullable<T>, number | string>;
type ScalarKindOf<T> = [Extract<NonNullable<T>, Date>] extends [never]
    ? [Extract<ScalarValue<T>, number>] extends [never]
        ? [Extract<ScalarValue<T>, string>] extends [never]
            ? never
            : string extends Extract<ScalarValue<T>, string>
              ? "string"
              : "enum"
        : "number"
    : "date";
type SplitPath<Path extends string> = Path extends `${infer Head}.${infer Tail}`
    ? [Head, ...SplitPath<Tail>]
    : [Path];
type ValidatedPath<
    T,
    Segments extends readonly string[],
    Kind extends ScalarKind
> = Segments extends readonly [
    infer Head extends string,
    ...infer Tail extends string[]
]
    ? Head extends IgnoredWhereKey
        ? false
        : Head extends StringKeyOfUnion<NonNullable<T>>
          ? Tail extends []
              ? ScalarKindOf<ValueOfUnion<NonNullable<T>, Head>> extends Kind
                  ? true
                  : false
              : ValidatedPath<ValueOfUnion<NonNullable<T>, Head>, Tail, Kind>
          : false
    : false;
type WherePath<
    TWhere,
    Kind extends ScalarKind,
    Path extends string = string
> = string extends Path
    ? Path
    : ValidatedPath<TWhere, SplitPath<Path>, Kind> extends true
      ? Path
      : never;

export type NumberWherePath<TWhere, Path extends string = string> = Path &
    WherePath<TWhere, "number", Path>;
export type StringWherePath<TWhere, Path extends string = string> = Path &
    WherePath<TWhere, "string", Path>;
export type EnumWherePath<TWhere, Path extends string = string> = Path &
    WherePath<TWhere, "enum", Path>;
export type DateWherePath<TWhere, Path extends string = string> = Path &
    WherePath<TWhere, "date", Path>;

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

export function prismaWhereFor<TWhere>() {
    return {
        containsAt<const Path extends string>(
            path: StringWherePath<TWhere, Path>
        ): FilterWhereBuilder<TWhere> {
            return (expression) =>
                nestedWhere<TWhere>(path, {
                    contains: String(expression.values[0]),
                    mode: "insensitive"
                });
        },
        dateAt<const Path extends string>(
            path: DateWherePath<TWhere, Path>
        ): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, Date>(
                path,
                (value) => new Date(String(value))
            );
        },
        enumAt<const Path extends string>(
            path: EnumWherePath<TWhere, Path>
        ): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, string>(path, String);
        },
        numberAt<const Path extends string>(
            path: NumberWherePath<TWhere, Path>
        ): FilterWhereBuilder<TWhere> {
            return whereAt<TWhere, number>(path, Number);
        },
        stringAt<const Path extends string>(
            path: StringWherePath<TWhere, Path>
        ): FilterWhereBuilder<TWhere> {
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
