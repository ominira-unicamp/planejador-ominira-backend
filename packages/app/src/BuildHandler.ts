import type { Principal } from "#/auth.js";
import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import type { ExchangeNoticeSubscriptionService } from "#/modules/exchange/exchange-notice-subscription/ExchangeNoticeSubscription.service.js";
import type { ExchangeNoticeUnsubscribeService } from "#/modules/exchange/exchange-notice-unsubscribe/ExchangeNoticeUnsubscribe.service.js";
import type { FeedbackReportService } from "#/modules/feedback/feedback-report/FeedbackReport.service.js";
import type { AuthUserService } from "#/modules/identity/auth-user/AuthUser.service.js";
import type { BotGrantService } from "#/modules/identity/bot-grant/BotGrant.service.js";
import type { CurrentUserService } from "#/modules/identity/current-user/CurrentUser.service.js";
import type { CurriculumService } from "#/modules/planning/curriculum/Curriculum.service.js";
import type { PeriodPlanService } from "#/modules/planning/period-plan/PeriodPlan.service.js";
import type { ProfessorEvaluationService } from "#/modules/planning/professor-evaluation/ProfessorEvaluation.service.js";
import type { SharedPeriodPlanService } from "#/modules/planning/shared-period-plan/SharedPeriodPlan.service.js";
import type { StudentAbsenceService } from "#/modules/planning/student-absence/StudentAbsence.service.js";
import type { StudentCourseAttemptService } from "#/modules/planning/student-course-attempt/StudentCourseAttempt.service.js";
import type { StudentHistoryImportService } from "#/modules/planning/student-history-import/StudentHistoryImport.service.js";
import type { StudentService } from "#/modules/planning/student/Student.service.js";
import type { StudentSocialService } from "#/modules/social/student-social/StudentSocial.service.js";
import type { StudentTagInterestService } from "#/modules/student-tag-interest/StudentTagInterest.service.js";
import type { TaggingService } from "#/modules/tagging/Tagging.service.js";
import {
    createEndpointRegistries,
    type EndpointActions,
    type EndpointRegistry
} from "@pomi/api-core";

export type Context = {
    principal?: Principal;
    studentCourseAttemptService: StudentCourseAttemptService;
    studentHistoryImportService: StudentHistoryImportService;
    studentAbsenceService: StudentAbsenceService;
    studentService: StudentService;
    currentUserService: CurrentUserService;
    botGrantService: BotGrantService;
    authUserService: AuthUserService;
    curriculumService: CurriculumService;
    periodPlanService: PeriodPlanService;
    sharedPeriodPlanService: SharedPeriodPlanService;
    professorEvaluationService: ProfessorEvaluationService;
    studentSocialService: StudentSocialService;
    feedbackReportService: FeedbackReportService;
    exchangeNoticeSubscriptionService: ExchangeNoticeSubscriptionService;
    exchangeNoticeUnsubscribeService: ExchangeNoticeUnsubscribeService;
    taggingService: TaggingService;
    studentTagInterestService: StudentTagInterestService;
    requestIp: string;
};

export function createAppEndpointRegistries<
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
            principal: request.scope.cradle.principal,
            studentCourseAttemptService:
                request.scope.cradle.studentCourseAttemptService,
            studentHistoryImportService:
                request.scope.cradle.studentHistoryImportService,
            studentAbsenceService: request.scope.cradle.studentAbsenceService,
            studentService: request.scope.cradle.studentService,
            currentUserService: request.scope.cradle.currentUserService,
            botGrantService: request.scope.cradle.botGrantService,
            authUserService: request.scope.cradle.authUserService,
            curriculumService: request.scope.cradle.curriculumService,
            periodPlanService: request.scope.cradle.periodPlanService,
            sharedPeriodPlanService:
                request.scope.cradle.sharedPeriodPlanService,
            professorEvaluationService:
                request.scope.cradle.professorEvaluationService,
            studentSocialService: request.scope.cradle.studentSocialService,
            feedbackReportService: request.scope.cradle.feedbackReportService,
            exchangeNoticeSubscriptionService:
                request.scope.cradle.exchangeNoticeSubscriptionService,
            exchangeNoticeUnsubscribeService:
                request.scope.cradle.exchangeNoticeUnsubscribeService,
            taggingService: request.scope.cradle.taggingService,
            studentTagInterestService:
                request.scope.cradle.studentTagInterestService,
            requestIp: request.ip ?? "unknown"
        }),
        registerAuthorization: (method, path, authorization) =>
            authRegistry.addPolicy(method, path, authorization)
    });
    return { router, registry: openApiRegistry, authRegistry };
}
