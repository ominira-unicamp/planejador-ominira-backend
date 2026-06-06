import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/ClassInterface.js";
import { MyPrisma, selectIdCode, selectIdName } from "../../PrismaClient.js";

export const prismaClassFieldSelection = {
    include: {
        professors: selectIdName,
        studyPeriod: selectIdCode,
        course: {
            select: {
                id: true,
                code: true,
                institute: selectIdCode
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
        institute: resourcesPaths.institute.entity(
            classPayload.course.institute.id
        ),
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
        instituteId: course.institute.id,
        instituteCode: course.institute.code,
        professorIds: classData.professors.map((p) => p.id),
        _paths: relatedPathsForClass(classData)
    };
}

export default {
    build: buildClassEntity,
    prismaSelection: prismaClassFieldSelection
};
