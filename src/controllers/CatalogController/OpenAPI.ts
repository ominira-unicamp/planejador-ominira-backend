import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import catalogEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/catalogs',
	tags: ['catalogs'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/catalogs/{id}',
	'catalogs',
	catalogEntity.schema,
	"A catalog by id"
));

registry.registerPath({
	method: 'post',
	path: '/catalogs',
	tags: ['catalogs'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/catalogs/{id}',
	tags: ['catalogs'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/catalogs/{id}',
	tags: ['catalogs'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
