import {
    classScheduleDataSchema,
    type ClassScheduleListInput
} from "#/modules/schedule/class-schedule/ClassSchedule.contract.js";
import { classScheduleNotFoundProblem } from "#/modules/schedule/class-schedule/ClassSchedule.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import {
    MyPrisma,
    selectIdCode,
    whereIdCode,
    type PrismaClient
} from "@pomi/db";
import z from "zod";

type ClassScheduleData = z.infer<typeof classScheduleDataSchema>;

const prismaClassScheduleFieldSelection = {
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

function classScheduleData(
    classSchedule: PrismaClassSchedulePayload
): ClassScheduleData {
    const { room, class: classEntity, ...rest } = classSchedule;
    if (!classEntity.course.unit)
        throw new Error("A turma exige que o curso tenha uma unidade");
    return {
        ...rest,
        roomCode: room.code,
        classCode: classEntity.code,
        classId: classEntity.id,
        unitId: classEntity.course.unit.id,
        unitCode: classEntity.course.unit.code,
        courseId: classEntity.course.id,
        courseCode: classEntity.course.code,
        studyPeriodId: classEntity.studyPeriod.id,
        studyPeriodCode: classEntity.studyPeriod.code
    };
}

export type ClassScheduleListResult = {
    items: ClassScheduleData[];
    total: number;
};

export type ClassScheduleService = {
    list(input: ClassScheduleListInput): Promise<ClassScheduleListResult>;
    getById(
        id: number
    ): Promise<
        Result<
            ClassScheduleData,
            ReturnType<typeof classScheduleNotFoundProblem>
        >
    >;
};

export function createClassScheduleService({
    prisma
}: {
    prisma: PrismaClient;
}): ClassScheduleService {
    return {
        async list(input) {
            const where = {
                dayOfWeek: input.dayOfWeek,
                room: whereIdCode(input.roomId, input.roomCode),
                class: {
                    ...whereIdCode(input.classId, undefined),
                    course: {
                        ...whereIdCode(input.courseId, input.courseCode),
                        unit: whereIdCode(input.unitId, input.unitCode)
                    },
                    studyPeriod: whereIdCode(
                        input.studyPeriodId,
                        input.studyPeriodCode
                    )
                }
            };
            const [total, schedules] = await Promise.all([
                prisma.classSchedule.count({ where }),
                prisma.classSchedule.findMany({
                    skip: (input.page - 1) * input.pageSize,
                    take: input.pageSize,
                    ...prismaClassScheduleFieldSelection,
                    where
                })
            ]);
            return {
                total,
                items: schedules.map(classScheduleData)
            };
        },
        async getById(id) {
            const schedule = await prisma.classSchedule.findUnique({
                ...prismaClassScheduleFieldSelection,
                where: { id }
            });
            return schedule
                ? ok(classScheduleData(schedule))
                : err(classScheduleNotFoundProblem());
        }
    };
}
