import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/planning/contracts/students/StudentInterface.js";
import z from "zod";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaStudentPayload = MyPrisma.StudentGetPayload<{}>;

function relatedPathsForStudent(studentId: number) {
    return {
        classes: `/classes?studyPeriodId=${studentId}`,
        classSchedules: `/class-schedules?studyPeriodId=${studentId}`
    };
}

function buildStudentEntity(
    student: PrismaStudentPayload
): z.infer<typeof IO.schema> {
    return {
        ...student,
        _paths: relatedPathsForStudent(student.id)
    };
}

export default {
    build: buildStudentEntity
};
