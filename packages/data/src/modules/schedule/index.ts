import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import calendarEvent from "#/modules/schedule/calendar-event/index.js";
import calendarTag from "#/modules/schedule/calendar-tag/index.js";
import calendar from "#/modules/schedule/calendar/index.js";
import classSchedule from "#/modules/schedule/class-schedule/index.js";
import classController from "#/modules/schedule/class/index.js";
import dailyMenu from "#/modules/schedule/daily-menu/index.js";
import studyPeriods from "#/modules/schedule/study-period/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    calendar,
    calendarEvent,
    calendarTag,
    classController,
    classSchedule,
    dailyMenu,
    studyPeriods
];

const authRegistry = new AuthRegistry(
    controllers
        .filter((controller) => controller.authRegistry)
        .map((controller) => controller.authRegistry!)
);

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
