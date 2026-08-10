import { AuthRegistry } from "#/auth.js";
import academic from "#/modules/academic/index.js";
import catalog from "#/modules/catalog/index.js";
import identity from "#/modules/identity/index.js";
import type { ControllerDefinition } from "#/modules/Module.js";
import planning from "#/modules/planning/index.js";
import schedule from "#/modules/schedule/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

import course from "#/modules/academic/controllers/CourseController/CourseController.js";
import professor from "#/modules/academic/controllers/ProfessorController/ProfessorController.js";
import room from "#/modules/academic/controllers/RoomController/RoomController.js";
import unit from "#/modules/academic/controllers/UnitController/UnitController.js";
import catalogController from "#/modules/catalog/controllers/CatalogController/CatalogController.js";
import catalogProgram from "#/modules/catalog/controllers/CatalogProgramController/CatalogProgramController.js";
import curriculumSuggestion from "#/modules/catalog/controllers/CurriculumSuggestionController/CurriculumSuggestionController.js";
import language from "#/modules/catalog/controllers/LanguageController/LanguageController.js";
import program from "#/modules/catalog/controllers/ProgramController/ProgramController.js";
import specialization from "#/modules/catalog/controllers/SpecializationController/SpecializationController.js";
import CurriculumController from "#/modules/planning/controllers/StudentControllers/CurriculumController/CurriculumController.js";
import periodPlan from "#/modules/planning/controllers/StudentControllers/PeriodPlanController/PeriodPlanController.js";
import studentController from "#/modules/planning/controllers/StudentControllers/StudentController/StudentController.js";
import studentCourse from "#/modules/planning/controllers/StudentControllers/StudentCourseController/StudentCourseController.js";
import calendarEvent from "#/modules/schedule/controllers/CalendarEventController/CalendarEventController.js";
import calendarTag from "#/modules/schedule/controllers/CalendarTagController/CalendarTagController.js";
import classController from "#/modules/schedule/controllers/ClassController/ClassController.js";
import classSchedule from "#/modules/schedule/controllers/ClassScheduleController/ClassScheduleController.js";
import studyPeriods from "#/modules/schedule/controllers/StudyPeriodsController/StudyPeriodsController.js";

const modules = [identity, academic, catalog, schedule, planning];
const controllers: ControllerDefinition[] = modules.flatMap(
    (module) => module.controllers
);

const router = Router().use(modules.map((module) => module.router));
const registry = new OpenAPIRegistry(
    modules.map((module) => module.registry).flat()
);
const authRegistry = new AuthRegistry(
    modules.map((module) => module.authRegistry)
);

export default {
    router,
    registry,
    authRegistry,
    all: controllers
};

export const resourcesPaths = {
    calendarEvent: calendarEvent.paths,
    calendarTag: calendarTag.paths,
    class: classController.paths,
    classSchedule: classSchedule.paths,
    course: course.paths,
    curriculumSuggestion: curriculumSuggestion.paths,
    unit: unit.paths,
    professor: professor.paths,
    room: room.paths,
    studyPeriod: studyPeriods.paths,

    student: studentController.paths,
    curriculum: CurriculumController.paths,
    periodPlan: periodPlan.paths,
    studentCourse: studentCourse.paths,

    catalog: catalogController.paths,
    catalogProgram: catalogProgram.paths,
    program: program.paths,
    specialization: specialization.paths,
    language: language.paths
};
