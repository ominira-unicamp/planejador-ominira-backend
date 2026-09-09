import {
    classScheduleDataSchema,
    type ClassScheduleFilterName,
    type ClassScheduleListInput
} from "#/modules/schedule/class-schedule/ClassSchedule.contract.js";
import { classScheduleNotFoundProblem } from "#/modules/schedule/class-schedule/ClassSchedule.problems.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, type Result } from "@pomi/api-core";
import { MyPrisma, selectIdCode, type PrismaClient } from "@pomi/db";
import z from "zod";

const classScheduleWhere = prismaWhereFor<MyPrisma.ClassScheduleWhereInput>();
const classScheduleWhereDefinitions = {
    "dayOfWeek": classScheduleWhere.enumAt("dayOfWeek"),
    "room.id": classScheduleWhere.numberAt("room.id"),
    "room.code": classScheduleWhere.stringAt("room.code"),
    "class.id": classScheduleWhere.numberAt("class.id"),
    "course.id": classScheduleWhere.numberAt("class.course.id"),
    "course.code": classScheduleWhere.stringAt("class.course.code"),
    "unit.id": classScheduleWhere.numberAt("class.course.unit.id"),
    "unit.code": classScheduleWhere.stringAt("class.course.unit.code"),
    "studyPeriod.id": classScheduleWhere.numberAt("class.studyPeriod.id"),
    "studyPeriod.year": classScheduleWhere.numberAt("class.studyPeriod.year"),
    "studyPeriod.yearPeriod": classScheduleWhere.enumAt(
        "class.studyPeriod.yearPeriod"
    )
} satisfies Record<
    ClassScheduleFilterName,
    FilterWhereBuilder<MyPrisma.ClassScheduleWhereInput>
>;

export function classScheduleFilterWhere(
    filter: ClassScheduleListInput["filter"]
): MyPrisma.ClassScheduleWhereInput[] {
    return compileFilterWhere<MyPrisma.ClassScheduleWhereInput>(
        filter,
        classScheduleWhereDefinitions,
        "class schedule"
    );
}

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
                studyPeriod: {
                    select: { id: true, year: true, yearPeriod: true }
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
        studyPeriodYear: classEntity.studyPeriod.year,
        studyPeriodYearPeriod: classEntity.studyPeriod.yearPeriod
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
            const filterWhere = classScheduleFilterWhere(input.filter);
            const where: MyPrisma.ClassScheduleWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
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
