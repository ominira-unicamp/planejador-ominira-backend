import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { RequestHandler } from "express";

import type { DataConfig } from "#/Config.js";
import {
    createCourseService,
    type CourseService
} from "#/modules/academic/course/Course.service.js";
import {
    createEvaluationSummaryService,
    type EvaluationSummaryService
} from "#/modules/academic/evaluation-summary/EvaluationSummary.service.js";
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
    createCatalogCourseService,
    type CatalogCourseService
} from "#/modules/catalog/catalog-course/CatalogCourse.service.js";
import {
    createCatalogProgramService,
    type CatalogProgramService
} from "#/modules/catalog/catalog-program/CatalogProgram.service.js";
import {
    createCatalogService,
    type CatalogService
} from "#/modules/catalog/catalog/Catalog.service.js";
import {
    createCoordinatorService,
    type CoordinatorService
} from "#/modules/catalog/coordinator/Coordinator.service.js";
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
    createExchangeNoticeService,
    type ExchangeNoticeService
} from "#/modules/exchange/exchange-notice/ExchangeNotice.service.js";
import {
    createExchangePlaceService,
    type ExchangePlaceService
} from "#/modules/exchange/exchange-place/ExchangePlace.service.js";
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
    createDailyMenuService,
    type DailyMenuService
} from "#/modules/schedule/daily-menu/DailyMenu.service.js";
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
    catalogCourseService: CatalogCourseService;
    coordinatorService: CoordinatorService;
    curriculumSuggestionService: CurriculumSuggestionService;
    classScheduleService: ClassScheduleService;
    courseService: CourseService;
    evaluationSummaryService: EvaluationSummaryService;
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
    dailyMenuService: DailyMenuService;
    exchangeNoticeService: ExchangeNoticeService;
    exchangePlaceService: ExchangePlaceService;
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
        catalogCourseService: asFunction(createCatalogCourseService).scoped(),
        coordinatorService: asFunction(createCoordinatorService).scoped(),
        curriculumSuggestionService: asFunction(
            createCurriculumSuggestionService
        ).scoped(),
        classScheduleService: asFunction(createClassScheduleService).scoped(),
        courseService: asFunction(createCourseService).scoped(),
        evaluationSummaryService: asFunction(
            createEvaluationSummaryService
        ).scoped(),
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
        calendarService: asFunction(createCalendarService).scoped(),
        dailyMenuService: asFunction(createDailyMenuService).scoped(),
        exchangeNoticeService: asFunction(createExchangeNoticeService).scoped(),
        exchangePlaceService: asFunction(createExchangePlaceService).scoped()
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
