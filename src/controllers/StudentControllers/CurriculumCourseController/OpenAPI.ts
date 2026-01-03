import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { openApiArgsFromIO } from '../../../BuildHandler.js';
import IO from './Interface.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry()

registry.registerPath({
	method: 'post',
	path: '/student/{sid}/curricula/{cid}/courses',
	tags: ['curriculum-course'],
	...openApiArgsFromIO(IO.addCourse)
});

registry.registerPath({
	method: 'patch',
	path: '/student/{sid}/curricula/{cid}/courses/{courseId}',
	tags: ['curriculum-course'],
	...openApiArgsFromIO(IO.updateCourse)
});

registry.registerPath({
	method: 'delete',
	path: '/student/{sid}/curricula/{cid}/courses/{courseId}',
	tags: ['curriculum-course'],
	...openApiArgsFromIO(IO.removeCourse)
});

export default registry
