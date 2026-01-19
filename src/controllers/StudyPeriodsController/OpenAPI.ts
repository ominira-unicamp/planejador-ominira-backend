import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO  from './Interface.js';
import studyPeriodEntity from './Entity.js';
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()


registry.registerPath({
	method: 'get',
	path: '/study-periods',
	tags: ['studyPeriod'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/study-periods/{id}',
	'studyPeriod',
	studyPeriodEntity.schema,
	"A study period by id"
));

registry.registerPath({
	method: 'post',
	path: '/study-periods/',
	tags: ['studyPeriod'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/study-periods/{id}',
	tags: ['studyPeriod'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/study-periods/{id}',
	tags: ['studyPeriod'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
