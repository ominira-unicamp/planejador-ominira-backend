export type PathSegment =
    | { type: "literal"; value: string }
    | { type: "param"; name: string };
export const pathSeg = {
    literal(value: string): PathSegment {
        return { type: "literal", value };
    },
    param(name: string): PathSegment {
        return { type: "param", name };
    }
};
export function pathSegmentToOpenApiPath(segments: PathSegment[]): string {
    return (
        "/" +
        segments
            .map((seg) =>
                seg.type === "literal" ? seg.value : `{${seg.name}}`
            )
            .join("/")
    );
}

export function pathSegmentToExpressPath(segments: PathSegment[]): string {
    return (
        "/" +
        segments
            .map((segment) =>
                segment.type === "literal" ? segment.value : `:${segment.name}`
            )
            .join("/")
    );
}
