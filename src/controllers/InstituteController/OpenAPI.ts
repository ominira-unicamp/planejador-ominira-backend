import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import instituteEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/institutes',
	tags: ['institute'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/institutes/{id}',
	'institute',
	instituteEntity.schema,
	"An institute by id"
));

registry.registerPath({
	method: 'post',
	path: '/institutes',
	tags: ['institute'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/institutes/{id}',
	tags: ['institute'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/institutes/{id}',
	tags: ['institute'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
