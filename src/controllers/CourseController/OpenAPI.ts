import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { openApiArgsFromIO } from "../../BuildHandler.js";
import { defaultOpenApiGetPath } from "../../defaultEndpoint.js";
import courseEntity from "./Entity.js";
import IO from "./Interface.js";
extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();

registry.registerPath({
    method: "get",
    path: "/courses",
    tags: ["course"],
    ...openApiArgsFromIO(IO.list)
});

registry.registerPath(
    defaultOpenApiGetPath(
        "/courses/{id}",
        "course",
        courseEntity.schema,
        "A course by id"
    )
);

registry.registerPath({
    method: "post",
    path: "/courses",
    tags: ["course"],
    ...openApiArgsFromIO(IO.create)
});

registry.registerPath({
    method: "patch",
    path: "/courses/{id}",
    tags: ["course"],
    ...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
    method: "delete",
    path: "/courses/{id}",
    tags: ["course"],
    ...openApiArgsFromIO(IO.remove)
});

export default registry;
