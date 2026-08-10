import { AuthRegistry, policies, StudentCapabilities } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import CurriculumController from "#/modules/planning/controllers/StudentControllers/CurriculumController/CurriculumController.js";
import periodPlan from "#/modules/planning/controllers/StudentControllers/PeriodPlanController/PeriodPlanController.js";
import studentController from "#/modules/planning/controllers/StudentControllers/StudentController/StudentController.js";
import studentCourse from "#/modules/planning/controllers/StudentControllers/StudentCourseController/StudentCourseController.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    studentController,
    CurriculumController,
    periodPlan,
    studentCourse
];
const authRegistry = new AuthRegistry();
authRegistry.addPolicy("GET", "/students", policies.admin);
authRegistry.addPolicy(
    "GET",
    "/students/:id",
    policies.studentAccess("id", StudentCapabilities.PROFILE_READ)
);
authRegistry.addPolicy("POST", "/students", policies.studentRegistration);
authRegistry.addPolicy(
    "PATCH",
    "/students/:id",
    policies.studentAccess("id", StudentCapabilities.PROFILE_WRITE)
);
authRegistry.addPolicy(
    "DELETE",
    "/students/:id",
    policies.studentAccess("id", StudentCapabilities.PROFILE_WRITE)
);

for (const path of [
    "/student/:sid/courses",
    "/student/:sid/courses/:courseId"
]) {
    authRegistry.addPolicy(
        "GET",
        path,
        policies.studentAccess("sid", StudentCapabilities.HISTORY_READ)
    );
}
authRegistry.addPolicy(
    "PUT",
    "/student/:sid/courses/:courseId",
    policies.studentAccess("sid", StudentCapabilities.HISTORY_WRITE)
);
authRegistry.addPolicy(
    "POST",
    "/student/:sid/courses",
    policies.studentAccess("sid", StudentCapabilities.HISTORY_WRITE)
);
for (const method of ["PATCH", "DELETE"] as const) {
    authRegistry.addPolicy(
        method,
        "/student/:sid/courses/:courseId",
        policies.studentAccess("sid", StudentCapabilities.HISTORY_WRITE)
    );
}

for (const path of [
    "/student/:sid/curricula",
    "/student/:sid/curricula/:id",
    "/student/:sid/period-plannings",
    "/student/:sid/period-plannings/:id",
    "/student/:sid/period-plan",
    "/student/:sid/period-plan/:id"
]) {
    authRegistry.addPolicy(
        "GET",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_READ)
    );
}
for (const path of [
    "/student/:sid/curricula",
    "/student/:sid/period-plannings",
    "/student/:sid/period-plan"
]) {
    authRegistry.addPolicy(
        "POST",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_WRITE)
    );
}
for (const path of [
    "/student/:sid/curricula/:id",
    "/student/:sid/period-plannings/:id",
    "/student/:sid/period-plan/:id"
]) {
    authRegistry.addPolicy(
        "PATCH",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_WRITE)
    );
    authRegistry.addPolicy(
        "DELETE",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_WRITE)
    );
}

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
