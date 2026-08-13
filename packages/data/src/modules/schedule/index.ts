import { AuthRegistry, Capabilities, policies } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import calendar from "#/modules/schedule/controllers/CalendarController/CalendarController.js";
import calendarEvent from "#/modules/schedule/controllers/CalendarEventController/CalendarEventController.js";
import calendarTag from "#/modules/schedule/controllers/CalendarTagController/CalendarTagController.js";
import classController from "#/modules/schedule/controllers/ClassController/ClassController.js";
import classSchedule from "#/modules/schedule/controllers/ClassScheduleController/ClassScheduleController.js";
import studyPeriods from "#/modules/schedule/controllers/StudyPeriodsController/StudyPeriodsController.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    calendar,
    calendarEvent,
    calendarTag,
    classController,
    classSchedule,
    studyPeriods
];

const resources = [
    "/calendar-events",
    "/calendar-tags",
    "/classes",
    "/class-schedules",
    "/study-periods"
];
const authRegistry = new AuthRegistry(
    controllers
        .filter((controller) => controller.authRegistry)
        .map((controller) => controller.authRegistry!)
);

for (const path of resources) {
    authRegistry.addPolicy(
        "POST",
        path,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "PATCH",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "DELETE",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
}

export default {
    router: Router().use(
        controllers
            .filter((controller) => controller.router)
            .map((controller) => controller.router!)
    ),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
            .flat()
    ),
    authRegistry,
    controllers
} satisfies ModuleDefinition;
