import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import languageEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/languages',
	tags: ['languages'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/languages/{id}',
	'languages',
	languageEntity.schema,
	"A language by id"
));

registry.registerPath({
	method: 'post',
	path: '/languages',
	tags: ['languages'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/languages/{id}',
	tags: ['languages'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/languages/{id}',
	tags: ['languages'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
