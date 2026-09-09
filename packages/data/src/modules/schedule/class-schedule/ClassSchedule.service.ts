import {
    classScheduleDataSchema,
    type ClassScheduleListInput
} from "#/modules/schedule/class-schedule/ClassSchedule.contract.js";
import { classScheduleNotFoundProblem } from "#/modules/schedule/class-schedule/ClassSchedule.problems.js";
import type { QueryFilterOperator } from "@pomi/api-core";
import { err, ok, type Result } from "@pomi/api-core";
import {
    MyPrisma,
    selectIdCode,
    type DayOfWeek,
    type PrismaClient,
    type YearPeriods
} from "@pomi/db";
import z from "zod";

type FilterValue = string | number;

function scalarFilter<T extends FilterValue>(
    operator: QueryFilterOperator,
    values: T[]
): { equals?: T; not?: T; in?: T[] } {
    switch (operator) {
        case "eq":
            return { equals: values[0] };
        case "ne":
            return { not: values[0] };
        case "in":
            return { in: values };
        default:
            throw new Error(`Unsupported class schedule filter: ${operator}`);
    }
}

function dayOfWeekFilter(
    operator: QueryFilterOperator,
    values: DayOfWeek[]
): MyPrisma.EnumDayOfWeekFilter {
    return scalarFilter(operator, values);
}

function yearPeriodFilter(
    operator: QueryFilterOperator,
    values: YearPeriods[]
): MyPrisma.EnumYearPeriodsFilter {
    return scalarFilter(operator, values);
}

export function classScheduleFilterWhere(
    filter: ClassScheduleListInput["filter"]
): MyPrisma.ClassScheduleWhereInput[] {
    return (filter ?? []).map((expression) => {
        const path = expression.path.join(".");
        const values = expression.values;
        switch (path) {
            case "dayOfWeek":
                return {
                    dayOfWeek: dayOfWeekFilter(
                        expression.operator,
                        values as DayOfWeek[]
                    )
                };
            case "room.id":
                return {
                    room: {
                        id: scalarFilter(
                            expression.operator,
                            values as number[]
                        )
                    }
                };
            case "room.code":
                return {
                    room: {
                        code: scalarFilter(
                            expression.operator,
                            values as string[]
                        )
                    }
                };
            case "class.id":
                return {
                    class: {
                        id: scalarFilter(
                            expression.operator,
                            values as number[]
                        )
                    }
                };
            case "course.id":
                return {
                    class: {
                        course: {
                            id: scalarFilter(
                                expression.operator,
                                values as number[]
                            )
                        }
                    }
                };
            case "course.code":
                return {
                    class: {
                        course: {
                            code: scalarFilter(
                                expression.operator,
                                values as string[]
                            )
                        }
                    }
                };
            case "unit.id":
                return {
                    class: {
                        course: {
                            unit: {
                                id: scalarFilter(
                                    expression.operator,
                                    values as number[]
                                )
                            }
                        }
                    }
                };
            case "unit.code":
                return {
                    class: {
                        course: {
                            unit: {
                                code: scalarFilter(
                                    expression.operator,
                                    values as string[]
                                )
                            }
                        }
                    }
                };
            case "studyPeriod.id":
                return {
                    class: {
                        studyPeriod: {
                            id: scalarFilter(
                                expression.operator,
                                values as number[]
                            )
                        }
                    }
                };
            case "studyPeriod.year":
                return {
                    class: {
                        studyPeriod: {
                            year: scalarFilter(
                                expression.operator,
                                values as number[]
                            )
                        }
                    }
                };
            case "studyPeriod.yearPeriod":
                return {
                    class: {
                        studyPeriod: {
                            yearPeriod: yearPeriodFilter(
                                expression.operator,
                                values as YearPeriods[]
                            )
                        }
                    }
                };
            default:
                throw new Error(`Unsupported class schedule filter: ${path}`);
        }
    });
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
