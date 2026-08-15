import {
    classScheduleDataSchema,
    type ClassScheduleListInput,
    type CreateClassScheduleInput,
    type PatchClassScheduleInput
} from "#/modules/schedule/class-schedule/ClassSchedule.contract.js";
import {
    classScheduleNotFoundProblem,
    classScheduleReferenceNotFoundProblem,
    type ClassScheduleProblem
} from "#/modules/schedule/class-schedule/ClassSchedule.problems.js";
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
    create(
        input: CreateClassScheduleInput
    ): Promise<
        Result<
            ClassScheduleData,
            ReturnType<typeof classScheduleReferenceNotFoundProblem>
        >
    >;
    patch(
        id: number,
        input: PatchClassScheduleInput
    ): Promise<Result<ClassScheduleData, ClassScheduleProblem>>;
    remove(
        id: number
    ): Promise<Result<void, ReturnType<typeof classScheduleNotFoundProblem>>>;
};

async function invalidReferences(
    prisma: PrismaClient,
    input: Pick<PatchClassScheduleInput, "roomId" | "classId">
) {
    const [room, classEntity] = await Promise.all([
        input.roomId === undefined
            ? undefined
            : prisma.room.findUnique({ where: { id: input.roomId } }),
        input.classId === undefined
            ? undefined
            : prisma.class.findUnique({ where: { id: input.classId } })
    ]);
    return [
        ...(input.roomId !== undefined && !room
            ? [
                  {
                      path: ["roomId"],
                      message: "A sala informada não foi encontrada."
                  }
              ]
            : []),
        ...(input.classId !== undefined && !classEntity
            ? [
                  {
                      path: ["classId"],
                      message: "A turma informada não foi encontrada."
                  }
              ]
            : [])
    ];
}

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
        },
        async create(input) {
            const fields = await invalidReferences(prisma, input);
            if (fields.length > 0) {
                return err(classScheduleReferenceNotFoundProblem(fields));
            }
            const schedule = await prisma.classSchedule.create({
                data: input,
                ...prismaClassScheduleFieldSelection
            });
            return ok(classScheduleData(schedule));
        },
        async patch(id, input) {
            const existing = await prisma.classSchedule.findUnique({
                where: { id }
            });
            if (!existing) return err(classScheduleNotFoundProblem());
            const fields = await invalidReferences(prisma, input);
            if (fields.length > 0) {
                return err(classScheduleReferenceNotFoundProblem(fields));
            }
            const schedule = await prisma.classSchedule.update({
                where: { id },
                data: input,
                ...prismaClassScheduleFieldSelection
            });
            return ok(classScheduleData(schedule));
        },
        async remove(id) {
            const existing = await prisma.classSchedule.findUnique({
                where: { id }
            });
            if (!existing) return err(classScheduleNotFoundProblem());
            await prisma.classSchedule.delete({ where: { id } });
            return ok(undefined);
        }
    };
}
