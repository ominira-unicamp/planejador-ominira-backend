import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaCatalogCourseSelection = {
    include: {
        catalog: { select: { id: true, year: true } },
        course: { select: { id: true, code: true, credits: true } },
        coordinator: { select: { id: true, name: true } },
        prerequisites: {
            include: {
                items: {
                    select: {
                        code: true,
                        kind: true,
                        courseId: true
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.CatalogCourseDefaultArgs;

type PrismaCatalogCoursePayload = MyPrisma.CatalogCourseGetPayload<
    typeof prismaCatalogCourseSelection
>;

function buildCatalogCourseEntity(
    catalogCourse: PrismaCatalogCoursePayload
): z.infer<typeof IO.schema> {
    const { catalog, course, coordinator, prerequisites, ...data } =
        catalogCourse;
    return {
        id: data.id,
        catalogId: data.catalogId,
        catalogYear: catalog.year,
        courseId: data.courseId,
        code: course.code,
        name: data.name,
        credits: course.credits,
        coordinator,
        workload: {
            theoreticalHours: data.theoreticalHours,
            practicalHours: data.practicalHours,
            laboratoryHours: data.laboratoryHours,
            guidedActivityHours: data.guidedActivityHours,
            distanceHours: data.distanceHours,
            guidedExtensionHours: data.guidedExtensionHours,
            practicalExtensionHours: data.practicalExtensionHours,
            weeks: data.weeks,
            weeklyClassHours: data.weeklyClassHours,
            classroomHours: data.classroomHours
        },
        offeringPeriod: data.offeringPeriod,
        evaluation: data.evaluation,
        finalExam: data.finalExam,
        minimumAttendancePercent: data.minimumAttendancePercent,
        syllabus: data.syllabus,
        bibliography: data.bibliography,
        sourceUrl: data.sourceUrl,
        prerequisites: {
            any: prerequisites.map((group) => ({ all: group.items }))
        },
        _paths: {
            self: resourcesPaths.catalogCourse.entity(data.id),
            catalog: resourcesPaths.catalog.entity(data.catalogId),
            course: resourcesPaths.course.entity(data.courseId),
            coordinator: coordinator
                ? resourcesPaths.coordinator.entity(coordinator.id)
                : null
        }
    };
}

export default {
    build: buildCatalogCourseEntity,
    selection: prismaCatalogCourseSelection
};
