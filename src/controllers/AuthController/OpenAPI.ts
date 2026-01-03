import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'post',
	path: '/login',
	tags: ['auth'],
	...openApiArgsFromIO(IO.login)
});

export default registry
