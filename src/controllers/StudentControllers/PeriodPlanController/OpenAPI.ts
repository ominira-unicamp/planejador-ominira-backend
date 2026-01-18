import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../../BuildHandler.js';
import IO from './Interface.js';
import periodPlanningEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/student/{sid}/period-plan',
	tags: ['period-plan'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/student/{sid}/period-plan/{id}',
	'period-plan',
	periodPlanningEntity.schema,
	"A period planning by id"
));

registry.registerPath({
	method: 'post',
	path: '/student/{sid}/period-plan',
	tags: ['period-plan'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/student/{sid}/period-plan/{id}',
	tags: ['period-plan'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/student/{sid}/period-plan/{id}',
	tags: ['period-plan'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
