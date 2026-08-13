import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
    isCompatibilityContract,
    pathSegmentToExpressPath
} from "@pomi/api-core";
import { Router } from "express";

import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import course from "#/modules/academic/controllers/CourseController/CourseController.js";
import professor from "#/modules/academic/controllers/ProfessorController/ProfessorController.js";
import room from "#/modules/academic/controllers/RoomController/RoomController.js";
import unit from "#/modules/academic/controllers/UnitController/UnitController.js";
import academic from "#/modules/academic/index.js";
import catalogController from "#/modules/catalog/controllers/CatalogController/CatalogController.js";
import catalogProgram from "#/modules/catalog/controllers/CatalogProgramController/CatalogProgramController.js";
import curriculumSuggestion from "#/modules/catalog/controllers/CurriculumSuggestionController/CurriculumSuggestionController.js";
import language from "#/modules/catalog/controllers/LanguageController/LanguageController.js";
import program from "#/modules/catalog/controllers/ProgramController/ProgramController.js";
import specialization from "#/modules/catalog/controllers/SpecializationController/SpecializationController.js";
import catalog from "#/modules/catalog/index.js";
import type { ControllerDefinition } from "#/modules/Module.js";
import calendarEvent from "#/modules/schedule/controllers/CalendarEventController/CalendarEventController.js";
import calendarTag from "#/modules/schedule/controllers/CalendarTagController/CalendarTagController.js";
import classController from "#/modules/schedule/controllers/ClassController/ClassController.js";
import classSchedule from "#/modules/schedule/controllers/ClassScheduleController/ClassScheduleController.js";
import studyPeriods from "#/modules/schedule/controllers/StudyPeriodsController/StudyPeriodsController.js";
import schedule from "#/modules/schedule/index.js";

const modules = [academic, catalog, schedule];
const controllers: ControllerDefinition[] = modules.flatMap(
    (module) => module.controllers
);

const contractAuthRegistry = new AuthRegistry();
for (const controller of controllers) {
    for (const contract of Object.values(controller.contracts ?? {})) {
        if (!isCompatibilityContract(contract)) continue;
        contractAuthRegistry.addPolicy(
            contract.meta.method.toUpperCase() as
                | "GET"
                | "POST"
                | "PUT"
                | "PATCH"
                | "DELETE",
            pathSegmentToExpressPath(contract.meta.path),
            contract.meta.authorization as AuthorizationPolicy
        );
    }
}

const standaloneAuthRegistries = controllers
    .filter((controller) => !controller.contracts && controller.authRegistry)
    .map((controller) => controller.authRegistry!);

export const dataControllers = {
    router: Router().use(modules.map((module) => module.router)),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
    ),
    authRegistry: new AuthRegistry([
        contractAuthRegistry,
        ...standaloneAuthRegistries
    ]),
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
    catalog: catalogController.paths,
    catalogProgram: catalogProgram.paths,
    program: program.paths,
    specialization: specialization.paths,
    language: language.paths
};

export default dataControllers;
