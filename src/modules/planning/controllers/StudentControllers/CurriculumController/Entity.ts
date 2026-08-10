import { resourcesPaths } from "#/Controllers.js";
import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/planning/contracts/students/CurriculumInterface.js";
import z from "zod";

const courseSelection = {
    select: {
        id: true,
        code: true,
        name: true,
        credits: true
    }
} as const;

export const prismaCurriculumFieldSelection = {
    include: {
        courses: {
            include: { course: courseSelection }
        },
        periods: {
            select: { id: true, position: true },
            orderBy: { position: "asc" }
        }
    }
} as const satisfies MyPrisma.CurriculumDefaultArgs;

export const prismaCurriculumSummaryFieldSelection = {
    select: {
        id: true,
        studentId: true,
        name: true,
        catalogProgramId: true,
        catalogSpecializationId: true,
        catalogLanguageId: true,
        createdAt: true,
        updatedAt: true
    }
} as const satisfies MyPrisma.CurriculumDefaultArgs;

type PrismaCurriculumPayload = MyPrisma.CurriculumGetPayload<
    typeof prismaCurriculumFieldSelection
>;
type PrismaCurriculumSummaryPayload = MyPrisma.CurriculumGetPayload<
    typeof prismaCurriculumSummaryFieldSelection
>;

function relatedPathsForCurriculum(curriculumId: number, studentId: number) {
    return {
        self: resourcesPaths.curriculum.entity(studentId, curriculumId),
        student: resourcesPaths.student.entity(studentId)
    };
}

function selectionFromCurriculum(curriculum: {
    catalogProgramId: number | null;
    catalogSpecializationId: number | null;
    catalogLanguageId: number | null;
}) {
    return {
        catalogProgramId: curriculum.catalogProgramId,
        catalogSpecializationId: curriculum.catalogSpecializationId,
        catalogLanguageId: curriculum.catalogLanguageId
    };
}

function planningStartFromCurriculum(curriculum: {
    planningStartYear: number | null;
    planningStartSemester: number | null;
    planningStartNumber: number | null;
}) {
    if (
        curriculum.planningStartYear === null ||
        curriculum.planningStartSemester === null ||
        curriculum.planningStartNumber === null
    )
        return null;
    return {
        year: curriculum.planningStartYear,
        semester: curriculum.planningStartSemester as 1 | 2,
        semesterNumber: curriculum.planningStartNumber
    };
}

function buildCurriculumEntity(
    curriculum: PrismaCurriculumPayload
): z.infer<typeof IO.schema> {
    return {
        id: curriculum.id,
        studentId: curriculum.studentId,
        name: curriculum.name,
        selection: selectionFromCurriculum(curriculum),
        planningStart: planningStartFromCurriculum(curriculum),
        currentPeriodId: curriculum.currentPeriodId,
        courses: curriculum.courses.map(({ courseId, periodId, course }) => ({
            courseId,
            periodId,
            code: course.code,
            name: course.name,
            credits: course.credits
        })),
        periods: curriculum.periods,
        createdAt: curriculum.createdAt.toISOString(),
        updatedAt: curriculum.updatedAt.toISOString(),
        _paths: relatedPathsForCurriculum(curriculum.id, curriculum.studentId)
    };
}

function buildCurriculumSummary(
    curriculum: PrismaCurriculumSummaryPayload
): z.infer<typeof IO.summarySchema> {
    return {
        id: curriculum.id,
        studentId: curriculum.studentId,
        name: curriculum.name,
        selection: selectionFromCurriculum(curriculum),
        createdAt: curriculum.createdAt.toISOString(),
        updatedAt: curriculum.updatedAt.toISOString(),
        _paths: relatedPathsForCurriculum(curriculum.id, curriculum.studentId)
    };
}

export default {
    build: buildCurriculumEntity,
    buildSummary: buildCurriculumSummary,
    prismaSelection: prismaCurriculumFieldSelection,
    prismaSummarySelection: prismaCurriculumSummaryFieldSelection
};
