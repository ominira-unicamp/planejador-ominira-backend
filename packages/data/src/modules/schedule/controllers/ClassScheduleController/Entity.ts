import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/schedule/contracts/ClassScheduleInterface.js";
import { MyPrisma, selectIdCode } from "@pomi/db";
import z from "zod";

export const prismaClassScheduleFieldSelection = {
    include: {
        room: selectIdCode,
        class: {
            select: {
                id: true,
                code: true,
                courseId: true,
                studyPeriodId: true,
                studyPeriod: selectIdCode,
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
} as const satisfies MyPrisma.ClassScheduleDefaultArgs;

type PrismaClassSchedulePayload = MyPrisma.ClassScheduleGetPayload<
    typeof prismaClassScheduleFieldSelection
>;

function relatedPathsForClassSchedule(
    classScheduleId: number,
    studyPeriodId: number,
    unitId: number,
    courseId: number,
    classId: number
) {
    return {
        studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
        unit: resourcesPaths.unit.entity(unitId),
        course: resourcesPaths.course.entity(courseId),
        class: resourcesPaths.class.entity(classId),
        entity: `/class-schedules/${classScheduleId}`
    };
}

function buildClassScheduleEntity(
    classSchedule: PrismaClassSchedulePayload
): z.infer<typeof IO.schema> {
    const { room, class: classObj, ...rest } = classSchedule;
    return {
        ...rest,
        roomCode: room.code,
        classCode: classObj.code,
        classId: classObj.id,
        unitId: classObj.course.unit.id,
        unitCode: classObj.course.unit.code,
        courseId: classObj.course.id,
        courseCode: classObj.course.code,
        studyPeriodId: classObj.studyPeriod.id,
        studyPeriodCode: classObj.studyPeriod.code,
        _paths: relatedPathsForClassSchedule(
            classSchedule.id,
            classObj.studyPeriod.id,
            classObj.course.unit.id,
            classObj.course.id,
            classObj.id
        )
    };
}

export default {
    build: buildClassScheduleEntity,
    prismaSelection: prismaClassScheduleFieldSelection
};
