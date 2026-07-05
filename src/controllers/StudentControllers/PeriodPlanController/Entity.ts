import z from "zod";
import { resourcesPaths } from "../../../Controllers.js";
import IO from "../../../Interfaces/students/PeriodPlanInterface.js";
import { MyPrisma, selectIdCode, selectIdName } from "../../../PrismaClient.js";

export const prismaPeriodPlanningFieldSelection = {
    include: {
        studyPeriod: selectIdCode,
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
        )
    };
}

function buildPeriodPlanningEntity(
    periodPlanning: PrismaPeriodPlanningPayload
): z.infer<typeof IO.schema> {
    const { studyPeriod, classes, ...rest } = periodPlanning;
    return {
        ...rest,
        studyPeriodId: studyPeriod.id,
        studyPeriodCode: studyPeriod.code,
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
