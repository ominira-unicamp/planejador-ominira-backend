import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { RouteParameter } from "@asteasolutions/zod-to-openapi/dist/openapi-registry.js";
import {
    ReferenceObject,
    SchemaObject
} from "@asteasolutions/zod-to-openapi/dist/types.js";
import { ZodType } from "zod";
type RequestConfig = NonNullable<RouteConfig["request"]>;

class RequestBuilder {
    request: RequestConfig = {};
    query(schema: RouteParameter): RequestBuilder {
        this.request.query = schema;
        return this;
    }
    params(schema: RouteParameter): RequestBuilder {
        this.request.params = schema;
        return this;
    }
    body(
        schema: ZodType<unknown> | SchemaObject | ReferenceObject,
        description: string
    ): RequestBuilder {
        this.request.body = {
            description: description,
            required: true,
            content: {
                "application/json": {
                    schema: schema
                }
            }
        };
        return this;
    }
    build(): RequestConfig {
        return this.request;
    }
}

export default RequestBuilder;
