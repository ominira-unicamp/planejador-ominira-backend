import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import curriculum from "#/modules/planning/curriculum/index.js";
import periodPlan from "#/modules/planning/period-plan/index.js";
import periodPlanAlias from "#/modules/planning/period-plan/PeriodPlanAlias.controller.js";
import professorEvaluation from "#/modules/planning/professor-evaluation/index.js";
import studentAbsence from "#/modules/planning/student-absence/index.js";
import studentCourseAttempt from "#/modules/planning/student-course-attempt/index.js";
import studentHistoryImport from "#/modules/planning/student-history-import/index.js";
import student from "#/modules/planning/student/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    student,
    curriculum,
    periodPlan,
    periodPlanAlias,
    professorEvaluation,
    studentCourseAttempt,
    studentHistoryImport,
    studentAbsence
];
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
    authRegistry: new AuthRegistry(
        controllers
            .filter((controller) => controller.authRegistry)
            .map((controller) => controller.authRegistry!)
    ),
    controllers
} satisfies ModuleDefinition;
