import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import classEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/classes',
	tags: ['class'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/classes/{id}',
	'class',
	classEntity.schema,
	"A class"
));

registry.registerPath({
	method: 'post',
	path: '/classes',
	tags: ['class'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/classes/{id}',
	tags: ['class'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/classes/{id}',
	tags: ['class'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
