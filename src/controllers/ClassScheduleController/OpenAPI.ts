import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import classScheduleEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/class-schedules',
	tags: ['class-schedule'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/class-schedules/{id}',
	'class-schedule',
	classScheduleEntity.schema,
	"A class schedule by id"
));

registry.registerPath({
	method: 'post',
	path: '/class-schedules',
	tags: ['class-schedule'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/class-schedules/{id}',
	tags: ['class-schedule'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/class-schedules/{id}',
	tags: ['class-schedule'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
