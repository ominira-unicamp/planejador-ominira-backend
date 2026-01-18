import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../../BuildHandler.js';
import IO from './Interface.js';
import studentCourseEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/student/{sid}/courses',
	tags: ['student-courses'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/student/{sid}/courses/{id}',
	'student-courses',
	studentCourseEntity.schema,
	"A student course by id"
));

registry.registerPath({
	method: 'post',
	path: '/student/{sid}/courses',
	tags: ['student-courses'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/student/{sid}/courses/{id}',
	tags: ['student-courses'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/student/{sid}/courses/{id}',
	tags: ['student-courses'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
