import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/ClassScheduleInterface.js";
import { MyPrisma, selectIdCode } from "../../PrismaClient.js";

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
                        institute: selectIdCode
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
    instituteId: number,
    courseId: number,
    classId: number
) {
    return {
        studyPeriod: resourcesPaths.studyPeriod.entity(studyPeriodId),
        institute: resourcesPaths.institute.entity(instituteId),
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
        instituteId: classObj.course.institute.id,
        instituteCode: classObj.course.institute.code,
        courseId: classObj.course.id,
        courseCode: classObj.course.code,
        studyPeriodId: classObj.studyPeriod.id,
        studyPeriodCode: classObj.studyPeriod.code,
        _paths: relatedPathsForClassSchedule(
            classSchedule.id,
            classObj.studyPeriod.id,
            classObj.course.institute.id,
            classObj.course.id,
            classObj.id
        )
    };
}

export default {
    build: buildClassScheduleEntity,
    prismaSelection: prismaClassScheduleFieldSelection
};
