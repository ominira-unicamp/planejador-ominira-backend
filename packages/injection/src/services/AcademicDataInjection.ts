import { DayOfWeek, YearPeriods, studyPeriodCode } from "@pomi/db";
import { readFile } from "node:fs/promises";
import { withAuditTransaction } from "../audit-context.js";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

export type AcademicDataInjectionOptions = {
    databaseConcurrency?: number;
};
interface Aula {
    weekday: string;
    time: {
        start: string;
        end: string;
    };
    room: string;
}
interface Turma {
    name: string;
    professors: string[];
    classes: Aula[];
    reservations: number[];
}
interface Disciplina {
    code: string;
    name: string;
    classes: Turma[];
}
interface Instituto {
    code: string;
    name: string;
    courses: Disciplina[];
}
interface AcademicData {
    year: number;
    semester: number;
    institutes: Instituto[];
}

const dayOfWeekMap: Record<string, DayOfWeek> = {
    Segunda: DayOfWeek.MONDAY,
    Terça: DayOfWeek.TUESDAY,
    Quarta: DayOfWeek.WEDNESDAY,
    Quinta: DayOfWeek.THURSDAY,
    Sexta: DayOfWeek.FRIDAY,
    Sábado: DayOfWeek.SATURDAY,
    Domingo: DayOfWeek.SUNDAY
};

async function mapWithConcurrency<T, R>(
    values: T[],
    concurrency: number,
    operation: (value: T) => Promise<R>
) {
    const results: R[] = new Array(values.length);
    let next = 0;
    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, values.length) },
            async () => {
                while (next < values.length) {
                    const index = next;
                    next += 1;
                    results[index] = await operation(values[index]);
                }
            }
        )
    );
    return results;
}

export async function injectAcademicData(
    { prisma, inputPath, logger, auditContext }: InjectionContext,
    { databaseConcurrency = 8 }: AcademicDataInjectionOptions = {}
) {
    if (!Number.isInteger(databaseConcurrency) || databaseConcurrency < 1)
        throw new Error("databaseConcurrency deve ser um inteiro positivo");
    logger.info("🌱 Iniciando injeção dos dados acadêmicos...");
    const changes = [] as Parameters<InjectionContext["logger"]["change"]>[0][];
    const parsedInput = unwrapScrapeData(
        JSON.parse(await readFile(inputPath, "utf-8"))
    );
    const academicData = (
        Array.isArray(parsedInput) ? parsedInput : [parsedInput]
    ) as AcademicData[];
    if (academicData.length === 0)
        throw new Error("Nenhum período acadêmico encontrado");

    const allUnits: Map<string, { code: string }> = new Map();
    const allProfessors: Map<string, { name: string }> = new Map();
    const allRooms: Map<string, { code: string }> = new Map();
    const allCourses: Map<
        string,
        { code: string; name: string; unitCode: string; credits: number }
    > = new Map();
    const studyPeriods = new Map<
        string,
        { year: number; yearPeriod: YearPeriods; startDate: Date }
    >();

    logger.info("📊 Coletando dados...");
    for (const period of academicData) {
        const yearPeriod =
            period.semester === 1
                ? YearPeriods.FIRST_SEMESTER
                : YearPeriods.SECOND_SEMESTER;
        const studyPeriod = {
            year: period.year,
            yearPeriod,
            startDate: new Date(
                `${period.year}-${period.semester === 1 ? "02" : "08"}-01`
            )
        };
        studyPeriods.set(studyPeriodCode(period.year, yearPeriod), studyPeriod);

        for (const instituteData of period.institutes) {
            allUnits.set(instituteData.code, { code: instituteData.code });

            for (const courseData of instituteData.courses) {
                allCourses.set(courseData.code, {
                    code: courseData.code,
                    name: courseData.name,
                    unitCode: instituteData.code,
                    credits: 4
                });

                for (const classData of courseData.classes) {
                    classData.professors
                        .filter((d) => d && d.trim() !== "")
                        .forEach((d) =>
                            allProfessors.set(d.trim(), { name: d.trim() })
                        );

                    classData.classes.forEach((classMeeting) =>
                        allRooms.set(classMeeting.room, {
                            code: classMeeting.room
                        })
                    );
                }
            }
        }
    }

    logger.info(`🏛️  Inserindo ${allUnits.size} institutos...`);
    await withAuditTransaction(prisma, auditContext, (transaction) =>
        transaction.unit.createMany({
            data: Array.from(allUnits.values()),
            skipDuplicates: true
        })
    );

    logger.info(`👨‍🏫 Inserindo ${allProfessors.size} professores...`);
    const existingProfessorNames = new Set(
        (await prisma.professor.findMany({ select: { name: true } })).map(
            ({ name }) => name
        )
    );
    const newProfessors = [...allProfessors.values()].filter(
        ({ name }) => !existingProfessorNames.has(name)
    );
    if (newProfessors.length > 0)
        await withAuditTransaction(prisma, auditContext, (transaction) =>
            transaction.professor.createMany({ data: newProfessors })
        );
    for (const professor of newProfessors)
        changes.push({
            entity: "Professor",
            operation: "create",
            key: { name: professor.name },
            before: null,
            after: professor
        });

    logger.info(`🚪 Inserindo ${allRooms.size} salas...`);
    await withAuditTransaction(prisma, auditContext, (transaction) =>
        transaction.room.createMany({
            data: Array.from(allRooms.values()),
            skipDuplicates: true
        })
    );

    logger.info(`📅 Inserindo ${studyPeriods.size} períodos de estudo...`);
    await mapWithConcurrency(
        [...studyPeriods.values()],
        databaseConcurrency,
        (studyPeriod) =>
            withAuditTransaction(prisma, auditContext, (transaction) =>
                transaction.studyPeriod.upsert({
                    where: {
                        year_yearPeriod: {
                            year: studyPeriod.year,
                            yearPeriod: studyPeriod.yearPeriod
                        }
                    },
                    create: studyPeriod,
                    update: { startDate: studyPeriod.startDate }
                })
            )
    );

    const unitsMap = new Map(
        (await prisma.unit.findMany()).map((i) => [i.code, i])
    );

    logger.info(`📚 Inserindo ${allCourses.size} cursos...`);
    await mapWithConcurrency(
        [...allCourses.values()],
        databaseConcurrency,
        (course) => {
            const unit = unitsMap.get(course.unitCode);
            if (!unit)
                throw new Error(`Unidade não encontrada: ${course.unitCode}`);
            return withAuditTransaction(prisma, auditContext, (transaction) =>
                transaction.course.upsert({
                    where: { code: course.code },
                    create: {
                        code: course.code,
                        name: course.name,
                        credits: course.credits,
                        unitId: unit.id
                    },
                    update: { unitId: unit.id }
                })
            );
        }
    );

    const professorsMap = new Map(
        (await prisma.professor.findMany()).map((p) => [p.name, p])
    );
    const roomsMap = new Map(
        (await prisma.room.findMany()).map((r) => [r.code, r])
    );
    const coursesMap = new Map(
        (await prisma.course.findMany()).map((c) => [c.code, c])
    );
    const studyPeriodsMap = new Map(
        (await prisma.studyPeriod.findMany()).map((sp) => [
            studyPeriodCode(sp.year, sp.yearPeriod),
            sp
        ])
    );

    logger.info("\n👥 Coletando turmas...");
    const allClasses: Array<{
        code: string;
        courseId: number;
        studyPeriodId: number;
        reservations: number[];
        professorIds: number[];
        turmaKey: string;
    }> = [];

    for (const period of academicData) {
        const yearPeriod =
            period.semester === 1
                ? YearPeriods.FIRST_SEMESTER
                : YearPeriods.SECOND_SEMESTER;
        const studyPeriod = studyPeriodsMap.get(
            studyPeriodCode(period.year, yearPeriod)
        );
        if (!studyPeriod)
            throw new Error(
                `Período não encontrado: ${period.year}s${period.semester}`
            );

        for (const instituteData of period.institutes) {
            for (const courseData of instituteData.courses) {
                const course = coursesMap.get(courseData.code);
                if (!course)
                    throw new Error(
                        `Disciplina não encontrada: ${courseData.code}`
                    );

                for (const classData of courseData.classes) {
                    const professorIds = classData.professors
                        .filter((d) => d && d.trim() !== "")
                        .map((d) => {
                            const professor = professorsMap.get(d.trim());
                            if (!professor)
                                throw new Error(
                                    `Professor não encontrado: ${d.trim()}`
                                );
                            return professor.id;
                        });

                    allClasses.push({
                        code: classData.name,
                        courseId: course.id,
                        studyPeriodId: studyPeriod.id,
                        reservations: classData.reservations,
                        professorIds,
                        turmaKey: `${period.year}-${yearPeriod}-${courseData.code}-${classData.name}`
                    });
                }
            }
        }
    }

    const uniqueClasses = [
        ...new Map(allClasses.map((item) => [item.turmaKey, item])).values()
    ];
    logger.info(`👥 Inserindo ${uniqueClasses.length} turmas...`);
    const createdClassesArray = await prisma.class.findMany({
        include: { course: true, studyPeriod: true }
    });
    const classesMap = new Map(
        createdClassesArray.map((c) => [
            `${c.studyPeriod.year}-${c.studyPeriod.yearPeriod}-${c.course.code}-${c.code}`,
            c
        ])
    );
    const persistedClasses = await mapWithConcurrency(
        uniqueClasses,
        databaseConcurrency,
        async (classData) => {
            const existingClass = classesMap.get(classData.turmaKey);
            const persisted = await withAuditTransaction(
                prisma,
                auditContext,
                (transaction) =>
                    existingClass
                        ? transaction.class.update({
                              where: { id: existingClass.id },
                              data: { reservations: classData.reservations },
                              include: { course: true, studyPeriod: true }
                          })
                        : transaction.class.create({
                              data: {
                                  code: classData.code,
                                  courseId: classData.courseId,
                                  studyPeriodId: classData.studyPeriodId,
                                  reservations: classData.reservations
                              },
                              include: { course: true, studyPeriod: true }
                          })
            );
            if (!existingClass)
                changes.push({
                    entity: "Class",
                    operation: "create",
                    key: { id: persisted.id, code: classData.code },
                    before: null,
                    after: {
                        code: classData.code,
                        courseId: classData.courseId,
                        studyPeriodId: classData.studyPeriodId,
                        reservations: classData.reservations
                    }
                });
            else if (
                existingClass.reservations.join(",") !==
                classData.reservations.join(",")
            )
                changes.push({
                    entity: "Class",
                    operation: "update",
                    key: { id: persisted.id, code: classData.code },
                    changedFields: ["reservations"],
                    before: { reservations: existingClass.reservations },
                    after: { reservations: classData.reservations }
                });
            return [classData.turmaKey, persisted] as const;
        }
    );
    for (const [key, persisted] of persistedClasses)
        classesMap.set(key, persisted);

    logger.info("🔗 Conectando professores às turmas...");
    const professorConnections: Array<{ A: number; B: number }> = [];

    for (const classData of uniqueClasses) {
        const classEntity = classesMap.get(classData.turmaKey);
        if (!classEntity) continue;

        for (const professorId of classData.professorIds) {
            professorConnections.push({
                A: classEntity.id,
                B: professorId
            });
        }
    }

    logger.info(
        `🔗 Inserindo ${professorConnections.length} conexões professor-turma...`
    );
    for (let start = 0; start < professorConnections.length; start += 1_000) {
        const values = professorConnections
            .slice(start, start + 1_000)
            .map((c) => `(${c.A}, ${c.B})`)
            .join(", ");
        await withAuditTransaction(prisma, auditContext, (transaction) =>
            transaction.$executeRawUnsafe(
                `INSERT INTO "data"."_ClassToProfessor" ("A", "B") VALUES ${values} ON CONFLICT DO NOTHING`
            )
        );
    }

    logger.info("📅 Coletando horários...");
    const allSchedules: Array<{
        classId: number;
        roomId: number;
        dayOfWeek: DayOfWeek;
        start: string;
        end: string;
    }> = [];

    for (const period of academicData) {
        for (const instituteData of period.institutes) {
            for (const courseData of instituteData.courses) {
                for (const classData of courseData.classes) {
                    const yearPeriod =
                        period.semester === 1
                            ? YearPeriods.FIRST_SEMESTER
                            : YearPeriods.SECOND_SEMESTER;
                    const turmaKey = `${period.year}-${yearPeriod}-${courseData.code}-${classData.name}`;
                    const classEntity = classesMap.get(turmaKey);
                    if (!classEntity)
                        throw new Error(`Turma não encontrada: ${turmaKey}`);

                    for (const classMeeting of classData.classes) {
                        const dayOfWeek = dayOfWeekMap[classMeeting.weekday];
                        if (!dayOfWeek) continue;

                        const room = roomsMap.get(classMeeting.room);
                        if (!room)
                            throw new Error(
                                `Sala não encontrada: ${classMeeting.room}`
                            );
                        allSchedules.push({
                            classId: classEntity.id,
                            roomId: room.id,
                            dayOfWeek,
                            start: classMeeting.time.start,
                            end: classMeeting.time.end
                        });
                    }
                }
            }
        }
    }

    const existingScheduleKeys = new Set(
        (
            await prisma.classSchedule.findMany({
                where: {
                    classId: {
                        in: [
                            ...new Set(
                                allSchedules.map(({ classId }) => classId)
                            )
                        ]
                    }
                },
                select: {
                    classId: true,
                    roomId: true,
                    dayOfWeek: true,
                    start: true,
                    end: true
                }
            })
        ).map(
            (schedule) =>
                `${schedule.classId}:${schedule.roomId}:${schedule.dayOfWeek}:${schedule.start}:${schedule.end}`
        )
    );
    const uniqueSchedules = [
        ...new Map(
            allSchedules.map((schedule) => [
                `${schedule.classId}:${schedule.roomId}:${schedule.dayOfWeek}:${schedule.start}:${schedule.end}`,
                schedule
            ])
        ).values()
    ];
    const newSchedules = uniqueSchedules.filter(
        (schedule) =>
            !existingScheduleKeys.has(
                `${schedule.classId}:${schedule.roomId}:${schedule.dayOfWeek}:${schedule.start}:${schedule.end}`
            )
    );
    logger.info(`📅 Inserindo ${newSchedules.length} horários novos...`);
    if (newSchedules.length > 0)
        await withAuditTransaction(prisma, auditContext, (transaction) =>
            transaction.classSchedule.createMany({ data: newSchedules })
        );
    for (const schedule of newSchedules)
        changes.push({
            entity: "ClassSchedule",
            operation: "create",
            key: {
                classId: schedule.classId,
                roomId: schedule.roomId,
                dayOfWeek: schedule.dayOfWeek,
                start: schedule.start,
                end: schedule.end
            },
            before: null,
            after: schedule
        });

    logger.info(
        JSON.stringify(
            {
                units: allUnits.size,
                professors: allProfessors.size,
                rooms: allRooms.size,
                studyPeriods: studyPeriods.size,
                courses: allCourses.size,
                classes: uniqueClasses.length,
                schedules: newSchedules.length
            },
            null,
            2
        )
    );
    for (const change of changes) logger.change(change);
}
