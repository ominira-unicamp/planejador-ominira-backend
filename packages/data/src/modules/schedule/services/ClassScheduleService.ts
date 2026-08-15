import {
    classScheduleEntity as classScheduleSchema,
    type ClassScheduleListInput,
    type CreateClassScheduleInput,
    type PatchClassScheduleInput
} from "#/modules/schedule/contracts/ClassScheduleInterface.js";
import classScheduleEntity from "#/modules/schedule/controllers/ClassScheduleController/Entity.js";
import {
    classScheduleNotFoundProblem,
    classScheduleReferenceNotFoundProblem,
    type ClassScheduleProblem
} from "#/modules/schedule/problems/ClassScheduleProblems.js";
import { err, ok, type Result } from "@pomi/api-core";
import { whereIdCode, type PrismaClient } from "@pomi/db";
import z from "zod";

type ClassScheduleEntity = z.infer<typeof classScheduleSchema>;

export type ClassScheduleListResult = {
    items: ClassScheduleEntity[];
    total: number;
};

export type ClassScheduleService = {
    list(input: ClassScheduleListInput): Promise<ClassScheduleListResult>;
    getById(
        id: number
    ): Promise<
        Result<
            ClassScheduleEntity,
            ReturnType<typeof classScheduleNotFoundProblem>
        >
    >;
    create(
        input: CreateClassScheduleInput
    ): Promise<
        Result<
            ClassScheduleEntity,
            ReturnType<typeof classScheduleReferenceNotFoundProblem>
        >
    >;
    patch(
        id: number,
        input: PatchClassScheduleInput
    ): Promise<Result<ClassScheduleEntity, ClassScheduleProblem>>;
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
                    ...classScheduleEntity.prismaSelection,
                    where
                })
            ]);
            return {
                total,
                items: schedules.map(classScheduleEntity.build)
            };
        },
        async getById(id) {
            const schedule = await prisma.classSchedule.findUnique({
                ...classScheduleEntity.prismaSelection,
                where: { id }
            });
            return schedule
                ? ok(classScheduleEntity.build(schedule))
                : err(classScheduleNotFoundProblem());
        },
        async create(input) {
            const fields = await invalidReferences(prisma, input);
            if (fields.length > 0) {
                return err(classScheduleReferenceNotFoundProblem(fields));
            }
            const schedule = await prisma.classSchedule.create({
                data: input,
                ...classScheduleEntity.prismaSelection
            });
            return ok(classScheduleEntity.build(schedule));
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
                ...classScheduleEntity.prismaSelection
            });
            return ok(classScheduleEntity.build(schedule));
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
