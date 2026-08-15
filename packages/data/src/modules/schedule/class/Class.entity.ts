import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/schedule/class/Class.contract.js";
import { MyPrisma, selectIdCode, selectIdName } from "@pomi/db";
import z from "zod";

export const prismaClassFieldSelection = {
    include: {
        professors: selectIdName,
        studyPeriod: selectIdCode,
        course: {
            select: {
                id: true,
                code: true,
                unit: selectIdCode
            }
        }
    }
} as const satisfies MyPrisma.ClassDefaultArgs;

type PrismaClassPayload = MyPrisma.ClassGetPayload<
    typeof prismaClassFieldSelection
>;

function relatedPathsForClass(classPayload: PrismaClassPayload) {
    return {
        studyPeriod: resourcesPaths.studyPeriod.entity(
            classPayload.studyPeriod.id
        ),
        unit: resourcesPaths.unit.entity(classPayload.course.unit.id),
        course: resourcesPaths.course.entity(classPayload.course.id),
        class: resourcesPaths.class.entity(classPayload.id),
        classSchedules: resourcesPaths.classSchedule.list({
            classId: classPayload.id
        }),
        professors: resourcesPaths.professor.list({
            classId: classPayload.id
        })
    };
}

function buildClassEntity(
    classData: PrismaClassPayload
): z.infer<typeof IO.schema> {
    const { course, studyPeriod, ...rest } = classData;
    return {
        ...rest,
        studyPeriodId: studyPeriod.id,
        studyPeriodCode: studyPeriod.code,
        courseId: course.id,
        courseCode: course.code,
        unitId: course.unit.id,
        unitCode: course.unit.code,
        professorIds: classData.professors.map((p) => p.id),
        _paths: relatedPathsForClass(classData)
    };
}

export default {
    build: buildClassEntity,
    prismaSelection: prismaClassFieldSelection
};
