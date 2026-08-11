import { resourcesPaths } from "#/Controllers.js";
import { MyPrisma, selectIdCode, selectIdName } from "#/PrismaClient.js";
import IO from "#/modules/planning/contracts/students/PeriodPlanInterface.js";
import z from "zod";

export const prismaPeriodPlanningFieldSelection = {
    include: {
        studyPeriod: selectIdCode,
        curriculum: { select: { id: true } },
        curriculumSuggestion: { select: { id: true, catalogProgramId: true } },
        catalogProgram: { select: { id: true } },
        specialization: { select: { id: true } },
        language: { select: { id: true } },
        manualCourses: { select: { courseId: true } },
        classes: {
            include: {
                professors: selectIdName,
                studyPeriod: selectIdCode,
                classSchedules: {
                    select: {
                        id: true,
                        dayOfWeek: true,
                        start: true,
                        end: true,
                        room: selectIdCode
                    }
                },
                course: {
                    select: {
                        id: true,
                        code: true,
                        unit: selectIdCode
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.PeriodPlanningDefaultArgs;

type PrismaPeriodPlanningPayload = MyPrisma.PeriodPlanningGetPayload<
    typeof prismaPeriodPlanningFieldSelection
>;

function relatedPathsForPeriodPlanning(
    periodPlanning: PrismaPeriodPlanningPayload
) {
    return {
        self: resourcesPaths.periodPlan.entity(
            periodPlanning.studentId,
            periodPlanning.id
        ),
        student: resourcesPaths.student.entity(periodPlanning.studentId),
        studyPeriod: resourcesPaths.studyPeriod.entity(
            periodPlanning.studyPeriod.id
        ),
        curriculum: periodPlanning.curriculum
            ? resourcesPaths.curriculum.entity(
                  periodPlanning.studentId,
                  periodPlanning.curriculum.id
              )
            : null
    };
}

function buildPeriodPlanningEntity(
    periodPlanning: PrismaPeriodPlanningPayload
): z.infer<typeof IO.schema> {
    const {
        studyPeriod,
        curriculum,
        curriculumSuggestion,
        catalogProgram,
        specialization,
        language,
        manualCourses,
        classes,
        ...rest
    } = periodPlanning;
    return {
        ...rest,
        createdAt: periodPlanning.createdAt.toISOString(),
        updatedAt: periodPlanning.updatedAt.toISOString(),
        studyPeriodId: studyPeriod.id,
        studyPeriodCode: studyPeriod.code,
        curriculumId: curriculum?.id ?? null,
        guide: {
            mode: periodPlanning.guideMode,
            curriculumSource: periodPlanning.curriculumSource,
            curriculumId: curriculum?.id ?? null,
            suggestionId: curriculumSuggestion?.id ?? null,
            suggestionCatalogProgramId:
                curriculumSuggestion?.catalogProgramId ?? null,
            catalogProgramId: catalogProgram?.id ?? null,
            specializationId: specialization?.id ?? null,
            languageId: language?.id ?? null,
            manualCourseIds: manualCourses.map(({ courseId }) => courseId)
        },
        classes: classes.map((c) => {
            const { professors, ...classRest } = c;
            return {
                ...classRest,
                professors: professors.map((p) => ({
                    id: p.id,
                    name: p.name
                })),
                classSchedules: c.classSchedules.map((cs) => ({
                    id: cs.id,
                    dayOfWeek: cs.dayOfWeek,
                    start: cs.start,
                    end: cs.end,
                    roomId: cs.room.id,
                    roomCode: cs.room.code
                }))
            };
        }),
        _paths: relatedPathsForPeriodPlanning(periodPlanning)
    };
}

export default {
    build: buildPeriodPlanningEntity,
    prismaSelection: prismaPeriodPlanningFieldSelection
};
