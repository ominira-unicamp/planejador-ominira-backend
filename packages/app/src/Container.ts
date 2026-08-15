import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { RequestHandler } from "express";

import type { AppConfig } from "#/Config.js";
import { buildZodIds } from "#/PrismaValidator.js";
import type { Principal } from "#/auth.js";
import {
    createAuthUserService,
    type AuthUserService
} from "#/modules/identity/auth-user/AuthUser.service.js";
import {
    createBotGrantService,
    type BotGrantService
} from "#/modules/identity/bot-grant/BotGrant.service.js";
import {
    createCurrentUserService,
    type CurrentUserService
} from "#/modules/identity/current-user/CurrentUser.service.js";
import {
    createCurriculumService,
    type CurriculumService
} from "#/modules/planning/curriculum/Curriculum.service.js";
import {
    createPeriodPlanService,
    type PeriodPlanService
} from "#/modules/planning/period-plan/PeriodPlan.service.js";
import {
    createStudentCourseAttemptService,
    type StudentCourseAttemptService
} from "#/modules/planning/student-course-attempt/StudentCourseAttempt.service.js";
import {
    createStudentService,
    type StudentService
} from "#/modules/planning/student/Student.service.js";
import type { DatabaseClient } from "@pomi/db";

export type AppCradle = {
    config: AppConfig;
    prisma: DatabaseClient;
    principal: Principal | undefined;
    zodIds: ReturnType<typeof buildZodIds>;
    studentCourseAttemptService: StudentCourseAttemptService;
    studentService: StudentService;
    currentUserService: CurrentUserService;
    botGrantService: BotGrantService;
    authUserService: AuthUserService;
    curriculumService: CurriculumService;
    periodPlanService: PeriodPlanService;
};

export function createAppContainer(config: AppConfig, prisma: DatabaseClient) {
    return createContainer<AppCradle>({
        injectionMode: InjectionMode.CLASSIC
    }).register({
        config: asValue(config),
        prisma: asValue(prisma),
        principal: asValue(undefined),
        zodIds: asFunction(buildZodIds).scoped(),
        studentCourseAttemptService: asFunction(
            createStudentCourseAttemptService
        ).scoped(),
        studentService: asFunction(createStudentService).scoped(),
        currentUserService: asFunction(createCurrentUserService).scoped(),
        botGrantService: asFunction(createBotGrantService).scoped(),
        authUserService: asFunction(createAuthUserService).scoped(),
        curriculumService: asFunction(createCurriculumService).scoped(),
        periodPlanService: asFunction(createPeriodPlanService).scoped()
    });
}

export type AppContainer = ReturnType<typeof createAppContainer>;

export function appScopeMiddleware(container: AppContainer): RequestHandler {
    return (request, _response, next) => {
        const scope = container.createScope();
        request.scope = scope;
        request.prisma = scope.cradle.prisma;
        next();
    };
}
