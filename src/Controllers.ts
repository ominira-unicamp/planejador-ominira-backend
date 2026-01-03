import auth from './controllers/AuthController/AuthController.js'

import professor from './controllers/ProfessorController/ProfessorController.js'
import institute from './controllers/InstituteController/InstituteController.js'
import course from './controllers/CourseController/CourseController.js'
import classController from './controllers/ClassController/ClassController.js'
import studyPeriods from './controllers/StudyPeriodsController/StudyPeriodsController.js'
import classSchedule from './controllers/ClassScheduleController/ClassScheduleController.js'
import room from './controllers/RoomController/RoomController.js'

import studentController from './controllers/StudentControllers/StudentController/StudentController.js'
import CurriculumController from './controllers/StudentControllers/CurriculumController/CurriculumController.js'
import CurriculumCourseController from './controllers/StudentControllers/CurriculumCourseController/CurriculumCourseController.js'

import { Router } from 'express'
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { AuthRegistry } from './auth.js'

type Controler = {
	router?: Router,
	registry?: OpenAPIRegistry,
	authRegistry?: AuthRegistry,
}
const controllers: Controler[] = [
	auth,
	professor,
	institute,
	course,
	classController,
	classSchedule,
	room,
	studyPeriods,
	studentController,
	CurriculumController,
	CurriculumCourseController
] 

const router = Router().use(controllers.filter(c => c.router).map(c => c.router!));
const registry = new OpenAPIRegistry(controllers.filter(c => c.registry).map(c => c.registry!).flat());
const authRegistry = new AuthRegistry(controllers.filter(c => c.authRegistry).map(c => c.authRegistry!));
export default {
	router: router,
	registry: registry,
	authRegistry: authRegistry,	
	all: controllers,	
}

export const resourcesPaths = {
	auth: auth.paths,
	class: classController.paths,
	classSchedule: classSchedule.paths,
	course: course.paths,
	institute: institute.paths,
	professor: professor.paths,
	room: room.paths,
	studyPeriod: studyPeriods.paths,
	student: studentController.paths,
	curriculum: CurriculumController.paths,
	curriculumCourse: CurriculumCourseController.paths,
};