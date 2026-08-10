import { PathSegment, pathSeg } from "#/PathSegment.js";

export class SpecBuilder {
    constructor(
        private basePath: PathSegment[],
        private tags: string[],
        private identifier: string
    ) {}

    get() {
        return {
            method: "get" as const,
            path: this.basePath.concat(pathSeg.param(this.identifier)),
            tags: this.tags
        };
    }
    list() {
        return {
            method: "get" as const,
            path: this.basePath,
            tags: this.tags
        };
    }
    create() {
        return {
            method: "post" as const,
            path: this.basePath,
            tags: this.tags
        };
    }
    patch() {
        return {
            method: "patch" as const,
            path: this.basePath.concat(pathSeg.param(this.identifier)),
            tags: this.tags
        };
    }
    remove() {
        return {
            method: "delete" as const,
            path: this.basePath.concat(pathSeg.param(this.identifier)),
            tags: this.tags
        };
    }
}
