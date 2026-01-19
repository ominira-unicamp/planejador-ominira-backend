import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { openApiArgsFromIO } from '../../BuildHandler.js';
import IO from './Interface.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
	method: 'get',
	path: '/catalog/{catalogId}/program/{programId}',
	tags: ['CatalogProgram'],
	summary: 'Get a catalog program by ID',
	description: 'Retrieves a catalog program with its associated course blocks, specializations, and languages',
	...openApiArgsFromIO(IO.get),
});

registry.registerPath({
	method: 'get',
	path: '/catalog/{catalogId}/programs',
	tags: ['CatalogProgram'],
	summary: 'List all programs in a catalog',
	description: 'Retrieves all programs associated with a specific catalog',
	...openApiArgsFromIO(IO.list),
});

registry.registerPath({
	method: 'post',
	path: '/catalog/{catalogId}/programs',
	tags: ['CatalogProgram'],
	summary: 'Create a new catalog program',
	description: 'Creates a new program in a catalog with optional course blocks, specializations, and languages',
	...openApiArgsFromIO(IO.create),
});

registry.registerPath({
	method: 'patch',
	path: '/catalog/{catalogId}/program/{programId}',
	tags: ['CatalogProgram'],
	summary: 'Update a catalog program',
	description: 'Updates a catalog program. Supports operations: remove, add, upsert, update, set (executed in order, set makes all others ignored)',
	...openApiArgsFromIO(IO.patch),
});

registry.registerPath({
	method: 'delete',
	path: '/catalog/{catalogId}/program/{programId}',
	tags: ['CatalogProgram'],
	summary: 'Delete a catalog program',
	description: 'Deletes a catalog program and all its associated data',
	...openApiArgsFromIO(IO.remove),
});

export default registry;
