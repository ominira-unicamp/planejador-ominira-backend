import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DayOfWeek, PrismaClient } from "../prisma/generated/client.js";
import { unwrapScrapeData } from "./scrape-input.js";

dotenv.config();
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
const databaseConcurrency = Number(
    process.env.ACADEMIC_INJECTION_CONCURRENCY ?? "8"
);
if (!Number.isInteger(databaseConcurrency) || databaseConcurrency < 1)
    throw new Error(
        "ACADEMIC_INJECTION_CONCURRENCY deve ser um inteiro positivo"
    );
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

async function main() {
    console.log("🌱 Iniciando injeção dos dados acadêmicos...");

    const inputPath = resolve(
        process.env.ACADEMIC_DATA_INPUT ??
            resolve(import.meta.dirname, "../../prisma/seed.json")
    );
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
    const studyPeriods = new Map<string, { code: string; startDate: Date }>();

    console.log("📊 Coletando dados...");
    for (const period of academicData) {
        const studyPeriod = {
            code: `${period.year}s${period.semester}`,
            startDate: new Date(
                `${period.year}-${period.semester === 1 ? "02" : "08"}-01`
            )
        };
        studyPeriods.set(studyPeriod.code, studyPeriod);

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

    console.log(`\n🏛️  Inserindo ${allUnits.size} institutos...`);
    await prisma.unit.createMany({
        data: Array.from(allUnits.values()),
        skipDuplicates: true
    });

    console.log(`👨‍🏫 Inserindo ${allProfessors.size} professores...`);
    const existingProfessorNames = new Set(
        (await prisma.professor.findMany({ select: { name: true } })).map(
            ({ name }) => name
        )
    );
    const newProfessors = [...allProfessors.values()].filter(
        ({ name }) => !existingProfessorNames.has(name)
    );
    if (newProfessors.length > 0)
        await prisma.professor.createMany({ data: newProfessors });

    console.log(`🚪 Inserindo ${allRooms.size} salas...`);
    await prisma.room.createMany({
        data: Array.from(allRooms.values()),
        skipDuplicates: true
    });

    console.log(`📅 Inserindo ${studyPeriods.size} períodos de estudo...`);
    await mapWithConcurrency(
        [...studyPeriods.values()],
        databaseConcurrency,
        (studyPeriod) =>
            prisma.studyPeriod.upsert({
                where: { code: studyPeriod.code },
                create: studyPeriod,
                update: { startDate: studyPeriod.startDate }
            })
    );

    const unitsMap = new Map(
        (await prisma.unit.findMany()).map((i) => [i.code, i])
    );

    console.log(`📚 Inserindo ${allCourses.size} cursos...`);
    await mapWithConcurrency(
        [...allCourses.values()],
        databaseConcurrency,
        (course) => {
            const unit = unitsMap.get(course.unitCode);
            if (!unit)
                throw new Error(`Unidade não encontrada: ${course.unitCode}`);
            return prisma.course.upsert({
                where: { code: course.code },
                create: {
                    code: course.code,
                    name: course.name,
                    credits: course.credits,
                    unitId: unit.id
                },
                update: { unitId: unit.id }
            });
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
        (await prisma.studyPeriod.findMany()).map((sp) => [sp.code, sp])
    );

    console.log("\n👥 Coletando turmas...");
    const allClasses: Array<{
        code: string;
        courseId: number;
        studyPeriodId: number;
        reservations: number[];
        professorIds: number[];
        turmaKey: string;
    }> = [];

    for (const period of academicData) {
        const studyPeriod = studyPeriodsMap.get(
            `${period.year}s${period.semester}`
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
                        turmaKey: `${period.year}-${period.semester}-${courseData.code}-${classData.name}`
                    });
                }
            }
        }
    }

    const uniqueClasses = [
        ...new Map(allClasses.map((item) => [item.turmaKey, item])).values()
    ];
    console.log(`👥 Inserindo ${uniqueClasses.length} turmas...`);
    const createdClassesArray = await prisma.class.findMany({
        include: { course: true, studyPeriod: true }
    });
    const classesMap = new Map(
        createdClassesArray.map((c) => [
            `${c.studyPeriod.code.split("s")[0]}-${c.studyPeriod.code.split("s")[1]}-${c.course.code}-${c.code}`,
            c
        ])
    );
    const persistedClasses = await mapWithConcurrency(
        uniqueClasses,
        databaseConcurrency,
        async (classData) => {
            const existingClass = classesMap.get(classData.turmaKey);
            const persisted = existingClass
                ? await prisma.class.update({
                      where: { id: existingClass.id },
                      data: { reservations: classData.reservations },
                      include: { course: true, studyPeriod: true }
                  })
                : await prisma.class.create({
                      data: {
                          code: classData.code,
                          courseId: classData.courseId,
                          studyPeriodId: classData.studyPeriodId,
                          reservations: classData.reservations
                      },
                      include: { course: true, studyPeriod: true }
                  });
            return [classData.turmaKey, persisted] as const;
        }
    );
    for (const [key, persisted] of persistedClasses)
        classesMap.set(key, persisted);

    console.log("🔗 Conectando professores às turmas...");
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

    console.log(
        `🔗 Inserindo ${professorConnections.length} conexões professor-turma...`
    );
    for (let start = 0; start < professorConnections.length; start += 1_000) {
        const values = professorConnections
            .slice(start, start + 1_000)
            .map((c) => `(${c.A}, ${c.B})`)
            .join(", ");
        await prisma.$executeRawUnsafe(
            `INSERT INTO "_ClassToProfessor" ("A", "B") VALUES ${values} ON CONFLICT DO NOTHING`
        );
    }

    console.log("📅 Coletando horários...");
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
                    const turmaKey = `${period.year}-${period.semester}-${courseData.code}-${classData.name}`;
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
    console.log(`📅 Inserindo ${newSchedules.length} horários novos...`);
    if (newSchedules.length > 0)
        await prisma.classSchedule.createMany({ data: newSchedules });

    console.log(
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
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Erro durante a injeção:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
