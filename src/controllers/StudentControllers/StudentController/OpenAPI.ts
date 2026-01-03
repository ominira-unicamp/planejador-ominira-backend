import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../../BuildHandler.js';
import IO from './Interface.js';
import studentEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/students',
	tags: ['student'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/students/{id}',
	'student',
	studentEntity.schema,
	"A student by id"
));

registry.registerPath({
	method: 'post',
	path: '/students',
	tags: ['student'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/students/{id}',
	tags: ['student'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/students/{id}',
	tags: ['student'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
