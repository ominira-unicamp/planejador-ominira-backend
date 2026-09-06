import { buildZodIds } from "#/PrismaValidator.js";
import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import type { CourseService } from "#/modules/academic/course/Course.service.js";
import type { EvaluationSummaryService } from "#/modules/academic/evaluation-summary/EvaluationSummary.service.js";
import type { ProfessorDataPortalService } from "#/modules/academic/professor-data-portal/ProfessorDataPortal.service.js";
import type { ProfessorService } from "#/modules/academic/professor/Professor.service.js";
import type { RoomService } from "#/modules/academic/room/Room.service.js";
import type { UnitService } from "#/modules/academic/unit/Unit.service.js";
import type { CatalogCourseService } from "#/modules/catalog/catalog-course/CatalogCourse.service.js";
import type { CatalogProgramService } from "#/modules/catalog/catalog-program/CatalogProgram.service.js";
import type { CatalogService } from "#/modules/catalog/catalog/Catalog.service.js";
import type { CoordinatorService } from "#/modules/catalog/coordinator/Coordinator.service.js";
import type { CurriculumSuggestionService } from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.service.js";
import type { LanguageService } from "#/modules/catalog/language/Language.service.js";
import type { ProgramService } from "#/modules/catalog/program/Program.service.js";
import type { SpecializationService } from "#/modules/catalog/specialization/Specialization.service.js";
import type { ExchangeNoticeService } from "#/modules/exchange/exchange-notice/ExchangeNotice.service.js";
import type { ExchangePlaceService } from "#/modules/exchange/exchange-place/ExchangePlace.service.js";
import type { CalendarEventService } from "#/modules/schedule/calendar-event/CalendarEvent.service.js";
import type { CalendarTagService } from "#/modules/schedule/calendar-tag/CalendarTag.service.js";
import type { CalendarService } from "#/modules/schedule/calendar/Calendar.service.js";
import type { ClassScheduleService } from "#/modules/schedule/class-schedule/ClassSchedule.service.js";
import type { ClassService } from "#/modules/schedule/class/Class.service.js";
import type { DailyMenuService } from "#/modules/schedule/daily-menu/DailyMenu.service.js";
import type { StudyPeriodService } from "#/modules/schedule/study-period/StudyPeriod.service.js";
import {
    buildCompatibilityHandler,
    createEndpointRegistries,
    openApiFromEndpoint,
    ResponseSchemaBuilder,
    type CompatibilityAction,
    type CompatibilityContract,
    type EndpointActions,
    type EndpointRegistry
} from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";

export type Context = {
    prisma: PrismaClient;
    zodIds: ReturnType<typeof buildZodIds>;
    catalogProgramService: CatalogProgramService;
    catalogCourseService: CatalogCourseService;
    coordinatorService: CoordinatorService;
    curriculumSuggestionService: CurriculumSuggestionService;
    classScheduleService: ClassScheduleService;
    courseService: CourseService;
    evaluationSummaryService: EvaluationSummaryService;
    professorService: ProfessorService;
    professorDataPortalService: ProfessorDataPortalService;
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

export type HandlerFn<
    T extends Pick<CompatibilityContract, "request" | "response">
> = CompatibilityAction<T, Context>;

export const OutputBuilder = ResponseSchemaBuilder;
export type IO = CompatibilityContract;

export function buildHandler<
    RequestSchema extends CompatibilityContract["request"],
    ResponseSchema extends CompatibilityContract["response"]
>(
    request: RequestSchema,
    response: ResponseSchema,
    action: CompatibilityAction<
        {
            request: RequestSchema;
            response: ResponseSchema;
        },
        Context
    >
) {
    return buildCompatibilityHandler(request, response, action, (req) => ({
        prisma: req.scope.cradle.prisma,
        zodIds: req.scope.cradle.zodIds,
        catalogProgramService: req.scope.cradle.catalogProgramService,
        catalogCourseService: req.scope.cradle.catalogCourseService,
        coordinatorService: req.scope.cradle.coordinatorService,
        curriculumSuggestionService:
            req.scope.cradle.curriculumSuggestionService,
        classScheduleService: req.scope.cradle.classScheduleService,
        courseService: req.scope.cradle.courseService,
        evaluationSummaryService: req.scope.cradle.evaluationSummaryService,
        professorService: req.scope.cradle.professorService,
        professorDataPortalService: req.scope.cradle.professorDataPortalService,
        roomService: req.scope.cradle.roomService,
        unitService: req.scope.cradle.unitService,
        catalogService: req.scope.cradle.catalogService,
        languageService: req.scope.cradle.languageService,
        programService: req.scope.cradle.programService,
        specializationService: req.scope.cradle.specializationService,
        classService: req.scope.cradle.classService,
        studyPeriodService: req.scope.cradle.studyPeriodService,
        calendarTagService: req.scope.cradle.calendarTagService,
        calendarEventService: req.scope.cradle.calendarEventService,
        calendarService: req.scope.cradle.calendarService,
        dailyMenuService: req.scope.cradle.dailyMenuService,
        exchangeNoticeService: req.scope.cradle.exchangeNoticeService,
        exchangePlaceService: req.scope.cradle.exchangePlaceService
    }));
}

export function openApiArgsFromIO(contract: IO) {
    return openApiFromEndpoint(contract);
}

export function createDataEndpointRegistries<
    Contracts extends EndpointRegistry<AuthorizationPolicy>
>(
    contracts: Contracts,
    actions: EndpointActions<Contracts, AuthorizationPolicy, Context>
) {
    const authRegistry = new AuthRegistry();
    const { router, openApiRegistry } = createEndpointRegistries({
        contracts,
        actions,
        createContext: (request) => ({
            prisma: request.scope.cradle.prisma,
            zodIds: request.scope.cradle.zodIds,
            catalogProgramService: request.scope.cradle.catalogProgramService,
            catalogCourseService: request.scope.cradle.catalogCourseService,
            coordinatorService: request.scope.cradle.coordinatorService,
            curriculumSuggestionService:
                request.scope.cradle.curriculumSuggestionService,
            classScheduleService: request.scope.cradle.classScheduleService,
            courseService: request.scope.cradle.courseService,
            evaluationSummaryService:
                request.scope.cradle.evaluationSummaryService,
            professorService: request.scope.cradle.professorService,
            professorDataPortalService:
                request.scope.cradle.professorDataPortalService,
            roomService: request.scope.cradle.roomService,
            unitService: request.scope.cradle.unitService,
            catalogService: request.scope.cradle.catalogService,
            languageService: request.scope.cradle.languageService,
            programService: request.scope.cradle.programService,
            specializationService: request.scope.cradle.specializationService,
            classService: request.scope.cradle.classService,
            studyPeriodService: request.scope.cradle.studyPeriodService,
            calendarTagService: request.scope.cradle.calendarTagService,
            calendarEventService: request.scope.cradle.calendarEventService,
            calendarService: request.scope.cradle.calendarService,
            dailyMenuService: request.scope.cradle.dailyMenuService,
            exchangeNoticeService: request.scope.cradle.exchangeNoticeService,
            exchangePlaceService: request.scope.cradle.exchangePlaceService
        }),
        registerAuthorization: (method, path, authorization) =>
            authRegistry.addPolicy(method, path, authorization)
    });
    return { router, registry: openApiRegistry, authRegistry };
}
