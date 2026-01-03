import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../../BuildHandler.js';
import IO from './Interface.js';
import curriculumEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/student/{sid}/curricula',
	tags: ['curriculum'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/student/{sid}/curricula/{id}',
	'curriculum',
	curriculumEntity.schema,
	"A curriculum by id"
));

registry.registerPath({
	method: 'post',
	path: '/student/{sid}/curricula',
	tags: ['curriculum'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/student/{sid}/curricula/{id}',
	tags: ['curriculum'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/student/{sid}/curricula/{id}',
	tags: ['curriculum'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
