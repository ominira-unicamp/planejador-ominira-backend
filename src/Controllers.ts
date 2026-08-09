import calendar from "./controllers/CalendarController/CalendarController.js";
import calendarEvent from "./controllers/CalendarEventController/CalendarEventController.js";
import calendarTag from "./controllers/CalendarTagController/CalendarTagController.js";

import catalog from "./controllers/CatalogController/CatalogController.js";
import catalogProgram from "./controllers/CatalogProgramController/CatalogProgramController.js";
import classController from "./controllers/ClassController/ClassController.js";
import classSchedule from "./controllers/ClassScheduleController/ClassScheduleController.js";
import course from "./controllers/CourseController/CourseController.js";
import curriculumSuggestion from "./controllers/CurriculumSuggestionController/CurriculumSuggestionController.js";
import identity from "./controllers/IdentityController/IdentityController.js";
import language from "./controllers/LanguageController/LanguageController.js";
import professor from "./controllers/ProfessorController/ProfessorController.js";
import program from "./controllers/ProgramController/ProgramController.js";
import room from "./controllers/RoomController/RoomController.js";
import specialization from "./controllers/SpecializationController/SpecializationController.js";
import studyPeriods from "./controllers/StudyPeriodsController/StudyPeriodsController.js";
import unit from "./controllers/UnitController/UnitController.js";

import CurriculumController from "./controllers/StudentControllers/CurriculumController/CurriculumController.js";
import periodPlan from "./controllers/StudentControllers/PeriodPlanController/PeriodPlanController.js";
import studentController from "./controllers/StudentControllers/StudentController/StudentController.js";
import studentCourse from "./controllers/StudentControllers/StudentCourseController/StudentCourseController.js";

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import {
    AuthRegistry,
    Capabilities,
    policies,
    StudentCapabilities
} from "./auth.js";

type Controler = {
    router?: Router;
    registry?: OpenAPIRegistry;
    authRegistry?: AuthRegistry;
};
const controllers: Controler[] = [
    identity,
    calendar,
    calendarEvent,
    calendarTag,
    professor,
    unit,
    course,
    curriculumSuggestion,
    classController,
    classSchedule,
    room,
    studyPeriods,
    studentController,
    CurriculumController,
    periodPlan,
    studentCourse,
    catalog,
    catalogProgram,
    program,
    specialization,
    language
];

const router = Router().use(
    controllers.filter((c) => c.router).map((c) => c.router!)
);
const registry = new OpenAPIRegistry(
    controllers
        .filter((c) => c.registry)
        .map((c) => c.registry!)
        .flat()
);
const authRegistry = new AuthRegistry(
    controllers.filter((c) => c.authRegistry).map((c) => c.authRegistry!)
);

const academicResources = [
    "/calendar-events",
    "/calendar-tags",
    "/catalogs",
    "/catalog-program",
    "/classes",
    "/class-schedules",
    "/courses",
    "/curriculum-suggestions",
    "/languages",
    "/professors",
    "/programs",
    "/rooms",
    "/specializations",
    "/study-periods",
    "/units"
];

for (const path of academicResources) {
    authRegistry.addPolicy(
        "POST",
        path,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "PATCH",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "DELETE",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
}

authRegistry.addPolicy("GET", "/students", policies.admin);
authRegistry.addPolicy("GET", "/me", policies.authenticated);
authRegistry.addPolicy("GET", "/bots", policies.authenticated);
authRegistry.addPolicy("GET", "/me/bot-grants", policies.authenticated);
authRegistry.addPolicy(
    "PUT",
    "/me/bot-grants/:botAuthUserId",
    policies.authenticated
);
authRegistry.addPolicy("GET", "/admin/auth-users", policies.admin);
authRegistry.addPolicy("POST", "/admin/auth-users", policies.admin);
authRegistry.addPolicy("PATCH", "/admin/auth-users/:id", policies.admin);
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
for (const path of ["/student/:sid/courses/:courseId"]) {
    authRegistry.addPolicy(
        "PATCH",
        path,
        policies.studentAccess("sid", StudentCapabilities.HISTORY_WRITE)
    );
    authRegistry.addPolicy(
        "DELETE",
        path,
        policies.studentAccess("sid", StudentCapabilities.HISTORY_WRITE)
    );
}

for (const path of [
    "/student/:sid/curricula",
    "/student/:sid/curricula/:id",
    "/student/:sid/period-plan",
    "/student/:sid/period-plan/:id"
]) {
    authRegistry.addPolicy(
        "GET",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_READ)
    );
}
for (const path of ["/student/:sid/curricula", "/student/:sid/period-plan"]) {
    authRegistry.addPolicy(
        "POST",
        path,
        policies.studentAccess("sid", StudentCapabilities.PLANNING_WRITE)
    );
}
for (const path of [
    "/student/:sid/curricula/:id",
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
    router: router,
    registry: registry,
    authRegistry: authRegistry,
    all: controllers
};

export const resourcesPaths = {
    calendarEvent: calendarEvent.paths,
    calendarTag: calendarTag.paths,
    class: classController.paths,
    classSchedule: classSchedule.paths,
    course: course.paths,
    curriculumSuggestion: curriculumSuggestion.paths,
    unit: unit.paths,
    professor: professor.paths,
    room: room.paths,
    studyPeriod: studyPeriods.paths,

    student: studentController.paths,
    curriculum: CurriculumController.paths,
    periodPlan: periodPlan.paths,
    studentCourse: studentCourse.paths,

    catalog: catalog.paths,
    catalogProgram: catalogProgram.paths,
    program: program.paths,
    specialization: specialization.paths,
    language: language.paths
};
