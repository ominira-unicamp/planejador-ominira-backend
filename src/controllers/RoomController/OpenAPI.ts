import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import roomEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/rooms',
	tags: ['room'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/rooms/{id}',
	'room',
	roomEntity.schema,
	"A room by id"
));

registry.registerPath({
	method: 'post',
	path: '/rooms',
	tags: ['room'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/rooms/{id}',
	tags: ['room'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/rooms/{id}',
	tags: ['room'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
