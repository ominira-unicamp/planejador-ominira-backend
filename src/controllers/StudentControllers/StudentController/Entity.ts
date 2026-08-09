import z from "zod";
import IO from "../../../Interfaces/students/StudentInterface.js";
import { MyPrisma } from "../../../PrismaClient.js";

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
