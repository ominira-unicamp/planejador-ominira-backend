import teacher from './controllers/TeacherController'
import institute from './controllers/InstituteController'
import course from './controllers/CourseController'
import classController from './controllers/Class'
import courseOffering from './controllers/CourseOfferingController'


import { Router } from 'express'
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

export default {
	router: Router().use(
		teacher.router,
		institute.router,
		course.router,
		classController.router,
		courseOffering.router,
	),
	registry: new OpenAPIRegistry([
		teacher.registry,
		institute .registry,
		course .registry,
		classController .registry,
		courseOffering .registry,
	]),
	teacher, 
	institute,
	course,
	classController,
	courseOffering,
}