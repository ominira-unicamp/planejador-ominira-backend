import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
    isCompatibilityContract,
    pathSegmentToExpressPath
} from "@pomi/api-core";
import { Router } from "express";

import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import course from "#/modules/academic/course/index.js";
import academic from "#/modules/academic/index.js";
import professor from "#/modules/academic/professor/index.js";
import room from "#/modules/academic/room/index.js";
import unit from "#/modules/academic/unit/index.js";
import catalogCourse from "#/modules/catalog/catalog-course/index.js";
import catalogProgram from "#/modules/catalog/catalog-program/index.js";
import catalogController from "#/modules/catalog/catalog/index.js";
import coordinator from "#/modules/catalog/coordinator/index.js";
import curriculumSuggestion from "#/modules/catalog/curriculum-suggestion/index.js";
import catalog from "#/modules/catalog/index.js";
import language from "#/modules/catalog/language/index.js";
import program from "#/modules/catalog/program/index.js";
import specialization from "#/modules/catalog/specialization/index.js";
import exchangeNotice from "#/modules/exchange/exchange-notice/index.js";
import exchange from "#/modules/exchange/index.js";
import type { ControllerDefinition } from "#/modules/Module.js";
import calendarEvent from "#/modules/schedule/calendar-event/index.js";
import calendarTag from "#/modules/schedule/calendar-tag/index.js";
import classSchedule from "#/modules/schedule/class-schedule/index.js";
import classController from "#/modules/schedule/class/index.js";
import dailyMenu from "#/modules/schedule/daily-menu/index.js";
import schedule from "#/modules/schedule/index.js";
import studyPeriods from "#/modules/schedule/study-period/index.js";

const modules = [academic, catalog, exchange, schedule];
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
    dailyMenu: dailyMenu.paths,
    exchangeNotice: exchangeNotice.paths,
    course: course.paths,
    curriculumSuggestion: curriculumSuggestion.paths,
    unit: unit.paths,
    professor: professor.paths,
    room: room.paths,
    studyPeriod: studyPeriods.paths,
    catalog: catalogController.paths,
    catalogProgram: catalogProgram.paths,
    catalogCourse: catalogCourse.paths,
    coordinator: coordinator.paths,
    program: program.paths,
    specialization: specialization.paths,
    language: language.paths
};

export default dataControllers;
