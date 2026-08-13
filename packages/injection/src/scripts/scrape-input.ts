export type NativeScrapeResult<T> = {
    data: T;
    issues: unknown[];
    pages: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function unwrapScrapeData(value: unknown): unknown {
    if (
        isRecord(value) &&
        "data" in value &&
        Array.isArray(value.issues) &&
        Array.isArray(value.pages)
    )
        return value.data;
    return value;
}
