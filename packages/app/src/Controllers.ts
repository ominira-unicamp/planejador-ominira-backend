import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

import { AuthRegistry } from "#/auth.js";
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

export const appControllers = {
    router: Router().use(modules.map((module) => module.router)),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
    ),
    authRegistry: new AuthRegistry(
        modules.map((module) => module.authRegistry)
    ),
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
