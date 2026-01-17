import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { defaultOpenApiGetPath } from '../../defaultEndpoint.js';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';
import specializationEntity from './Entity.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'get',
	path: '/specializations',
	tags: ['specializations'],
	...openApiArgsFromIO(IO.list)
});

registry.registerPath(defaultOpenApiGetPath(
	'/specializations/{id}',
	'specializations',
	specializationEntity.schema,
	"A specialization by id"
));

registry.registerPath({
	method: 'post',
	path: '/specializations',
	tags: ['specializations'],
	...openApiArgsFromIO(IO.create)
});

registry.registerPath({
	method: 'patch',
	path: '/specializations/{id}',
	tags: ['specializations'],
	...openApiArgsFromIO(IO.patch)
});

registry.registerPath({
	method: 'delete',
	path: '/specializations/{id}',
	tags: ['specializations'],
	...openApiArgsFromIO(IO.remove)
});

export default registry
