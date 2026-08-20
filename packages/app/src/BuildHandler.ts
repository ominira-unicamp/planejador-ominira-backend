import type { Principal } from "#/auth.js";
import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import type { AuthUserService } from "#/modules/identity/auth-user/AuthUser.service.js";
import type { BotGrantService } from "#/modules/identity/bot-grant/BotGrant.service.js";
import type { CurrentUserService } from "#/modules/identity/current-user/CurrentUser.service.js";
import type { CurriculumService } from "#/modules/planning/curriculum/Curriculum.service.js";
import type { PeriodPlanService } from "#/modules/planning/period-plan/PeriodPlan.service.js";
import type { StudentAbsenceService } from "#/modules/planning/student-absence/StudentAbsence.service.js";
import type { StudentCourseAttemptService } from "#/modules/planning/student-course-attempt/StudentCourseAttempt.service.js";
import type { StudentService } from "#/modules/planning/student/Student.service.js";
import {
    createEndpointRegistries,
    type EndpointActions,
    type EndpointRegistry
} from "@pomi/api-core";

export type Context = {
    principal?: Principal;
    studentCourseAttemptService: StudentCourseAttemptService;
    studentAbsenceService: StudentAbsenceService;
    studentService: StudentService;
    currentUserService: CurrentUserService;
    botGrantService: BotGrantService;
    authUserService: AuthUserService;
    curriculumService: CurriculumService;
    periodPlanService: PeriodPlanService;
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
            studentAbsenceService: request.scope.cradle.studentAbsenceService,
            studentService: request.scope.cradle.studentService,
            currentUserService: request.scope.cradle.currentUserService,
            botGrantService: request.scope.cradle.botGrantService,
            authUserService: request.scope.cradle.authUserService,
            curriculumService: request.scope.cradle.curriculumService,
            periodPlanService: request.scope.cradle.periodPlanService
        }),
        registerAuthorization: (method, path, authorization) =>
            authRegistry.addPolicy(method, path, authorization)
    });
    return { router, registry: openApiRegistry, authRegistry };
}
