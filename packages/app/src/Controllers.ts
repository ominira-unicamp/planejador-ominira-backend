import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
    isCompatibilityContract,
    pathSegmentToExpressPath
} from "@pomi/api-core";
import { Router } from "express";

import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import identity from "#/modules/identity/index.js";
import type { ControllerDefinition } from "#/modules/Module.js";
import curriculum from "#/modules/planning/controllers/StudentControllers/CurriculumController/CurriculumController.js";
import periodPlan from "#/modules/planning/controllers/StudentControllers/PeriodPlanController/PeriodPlanController.js";
import student from "#/modules/planning/controllers/StudentControllers/StudentController/StudentController.js";
import studentCourse from "#/modules/planning/controllers/StudentControllers/StudentCourseController/StudentCourseController.js";
import planning from "#/modules/planning/index.js";

const modules = [identity, planning];
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

export const appControllers = {
    router: Router().use(modules.map((module) => module.router)),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
    ),
    authRegistry: new AuthRegistry([
        identity.authRegistry,
        contractAuthRegistry
    ]),
    all: controllers
};

export const resourcesPaths = {
    curriculum: curriculum.paths,
    periodPlan: periodPlan.paths,
    student: student.paths,
    studentCourse: studentCourse.paths,
    course: { entity: (id: number) => `/courses/${id}` },
    studyPeriod: { entity: (id: number) => `/study-periods/${id}` },
    class: { entity: (id: number) => `/classes/${id}` }
};

export default appControllers;
