import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import professorEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/professors',
	tags: ['professor'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/professors/{id}',
	'professor',
	professorEntity.schema,
	"A professor by id"
));

registry.registerPath({
	method: 'post',
	path: '/professors',
	tags: ['professor'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/professors/{id}',
	tags: ['professor'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/professors/{id}',
	tags: ['professor'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
