import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { RequestHandler } from "express";

import type { DataConfig } from "#/Config.js";
import {
    createCourseService,
    type CourseService
} from "#/modules/academic/course/Course.service.js";
import {
    createProfessorService,
    type ProfessorService
} from "#/modules/academic/professor/Professor.service.js";
import {
    createRoomService,
    type RoomService
} from "#/modules/academic/room/Room.service.js";
import {
    createUnitService,
    type UnitService
} from "#/modules/academic/unit/Unit.service.js";
import {
    createCatalogProgramService,
    type CatalogProgramService
} from "#/modules/catalog/catalog-program/CatalogProgram.service.js";
import {
    createCatalogService,
    type CatalogService
} from "#/modules/catalog/catalog/Catalog.service.js";
import {
    createCurriculumSuggestionService,
    type CurriculumSuggestionService
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.service.js";
import {
    createLanguageService,
    type LanguageService
} from "#/modules/catalog/language/Language.service.js";
import {
    createProgramService,
    type ProgramService
} from "#/modules/catalog/program/Program.service.js";
import {
    createSpecializationService,
    type SpecializationService
} from "#/modules/catalog/specialization/Specialization.service.js";
import {
    createCalendarEventService,
    type CalendarEventService
} from "#/modules/schedule/calendar-event/CalendarEvent.service.js";
import {
    createCalendarTagService,
    type CalendarTagService
} from "#/modules/schedule/calendar-tag/CalendarTag.service.js";
import {
    createCalendarService,
    type CalendarService
} from "#/modules/schedule/calendar/Calendar.service.js";
import {
    createClassScheduleService,
    type ClassScheduleService
} from "#/modules/schedule/class-schedule/ClassSchedule.service.js";
import {
    createClassService,
    type ClassService
} from "#/modules/schedule/class/Class.service.js";
import {
    createStudyPeriodService,
    type StudyPeriodService
} from "#/modules/schedule/study-period/StudyPeriod.service.js";
import { buildZodIds } from "#/PrismaValidator.js";
import type { DatabaseClient } from "@pomi/db";

export type DataCradle = {
    config: DataConfig;
    prisma: DatabaseClient;
    zodIds: ReturnType<typeof buildZodIds>;
    catalogProgramService: CatalogProgramService;
    curriculumSuggestionService: CurriculumSuggestionService;
    classScheduleService: ClassScheduleService;
    courseService: CourseService;
    professorService: ProfessorService;
    roomService: RoomService;
    unitService: UnitService;
    catalogService: CatalogService;
    languageService: LanguageService;
    programService: ProgramService;
    specializationService: SpecializationService;
    classService: ClassService;
    studyPeriodService: StudyPeriodService;
    calendarTagService: CalendarTagService;
    calendarEventService: CalendarEventService;
    calendarService: CalendarService;
};

export function createDataContainer(
    config: DataConfig,
    prisma: DatabaseClient
) {
    return createContainer<DataCradle>({
        injectionMode: InjectionMode.PROXY
    }).register({
        config: asValue(config),
        prisma: asValue(prisma),
        zodIds: asFunction(buildZodIds).scoped(),
        catalogProgramService: asFunction(createCatalogProgramService).scoped(),
        curriculumSuggestionService: asFunction(
            createCurriculumSuggestionService
        ).scoped(),
        classScheduleService: asFunction(createClassScheduleService).scoped(),
        courseService: asFunction(createCourseService).scoped(),
        professorService: asFunction(createProfessorService).scoped(),
        roomService: asFunction(createRoomService).scoped(),
        unitService: asFunction(createUnitService).scoped(),
        catalogService: asFunction(createCatalogService).scoped(),
        languageService: asFunction(createLanguageService).scoped(),
        programService: asFunction(createProgramService).scoped(),
        specializationService: asFunction(createSpecializationService).scoped(),
        classService: asFunction(createClassService).scoped(),
        studyPeriodService: asFunction(createStudyPeriodService).scoped(),
        calendarTagService: asFunction(createCalendarTagService).scoped(),
        calendarEventService: asFunction(createCalendarEventService).scoped(),
        calendarService: asFunction(createCalendarService).scoped()
    });
}

export type DataContainer = ReturnType<typeof createDataContainer>;

export function dataScopeMiddleware(container: DataContainer): RequestHandler {
    return (request, _response, next) => {
        const scope = container.createScope();
        request.scope = scope;
        request.prisma = scope.cradle.prisma;
        next();
    };
}
