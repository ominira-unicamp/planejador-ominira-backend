import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DayOfWeek, PrismaClient } from "../prisma/generated/client.js";

dotenv.config();
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
interface Aula {
    dia_semana: string;
    horario: {
        inicio: string;
        fim: string;
    };
    sala: string;
}
interface Turma {
    nome: string;
    docentes: string[];
    aulas: Aula[];
    reservas: number[];
}
interface Disciplina {
    codigo: string;
    nome: string;
    turmas: Turma[];
}
interface Instituto {
    nome: string;
    diciplinas: Disciplina[];
}
interface AcademicData {
    ano: number;
    semestre: number;
    institutos: Instituto[];
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

async function main() {
    console.log("🌱 Iniciando injeção dos dados acadêmicos...");

    const inputPath = resolve(
        process.env.ACADEMIC_DATA_INPUT ??
            resolve(import.meta.dirname, "../../prisma/seed.json")
    );
    const academicData = JSON.parse(
        await readFile(inputPath, "utf-8")
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
    for (const periodo of academicData) {
        const studyPeriod = {
            code: `${periodo.ano}s${periodo.semestre}`,
            startDate: new Date(
                `${periodo.ano}-${periodo.semestre === 1 ? "02" : "08"}-01`
            )
        };
        studyPeriods.set(studyPeriod.code, studyPeriod);

        for (const institutoData of periodo.institutos) {
            allUnits.set(institutoData.nome, { code: institutoData.nome });

            for (const disciplinaData of institutoData.diciplinas) {
                allCourses.set(disciplinaData.codigo, {
                    code: disciplinaData.codigo,
                    name: disciplinaData.nome,
                    unitCode: institutoData.nome,
                    credits: 4
                });

                for (const turmaData of disciplinaData.turmas) {
                    turmaData.docentes
                        .filter((d) => d && d.trim() !== "")
                        .forEach((d) =>
                            allProfessors.set(d.trim(), { name: d.trim() })
                        );

                    turmaData.aulas.forEach((a) =>
                        allRooms.set(a.sala, { code: a.sala })
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
    for (const studyPeriod of studyPeriods.values()) {
        await prisma.studyPeriod.upsert({
            where: { code: studyPeriod.code },
            create: studyPeriod,
            update: { startDate: studyPeriod.startDate }
        });
    }

    const unitsMap = new Map(
        (await prisma.unit.findMany()).map((i) => [i.code, i])
    );

    console.log(`📚 Inserindo ${allCourses.size} cursos...`);
    for (const course of allCourses.values()) {
        const unit = unitsMap.get(course.unitCode);
        if (!unit)
            throw new Error(`Unidade não encontrada: ${course.unitCode}`);
        await prisma.course.upsert({
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

    for (const periodo of academicData) {
        const studyPeriod = studyPeriodsMap.get(
            `${periodo.ano}s${periodo.semestre}`
        );
        if (!studyPeriod)
            throw new Error(
                `Período não encontrado: ${periodo.ano}s${periodo.semestre}`
            );

        for (const institutoData of periodo.institutos) {
            for (const disciplinaData of institutoData.diciplinas) {
                const course = coursesMap.get(disciplinaData.codigo);
                if (!course)
                    throw new Error(
                        `Disciplina não encontrada: ${disciplinaData.codigo}`
                    );

                for (const turmaData of disciplinaData.turmas) {
                    const professorIds = turmaData.docentes
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
                        code: turmaData.nome,
                        courseId: course.id,
                        studyPeriodId: studyPeriod.id,
                        reservations: turmaData.reservas,
                        professorIds,
                        turmaKey: `${periodo.ano}-${periodo.semestre}-${disciplinaData.codigo}-${turmaData.nome}`
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
    for (const classData of uniqueClasses) {
        const existingClass = classesMap.get(classData.turmaKey);
        if (existingClass) {
            await prisma.class.update({
                where: { id: existingClass.id },
                data: { reservations: classData.reservations }
            });
            continue;
        }
        const createdClass = await prisma.class.create({
            data: {
                code: classData.code,
                courseId: classData.courseId,
                studyPeriodId: classData.studyPeriodId,
                reservations: classData.reservations
            },
            include: { course: true, studyPeriod: true }
        });
        classesMap.set(classData.turmaKey, createdClass);
    }

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

    for (const periodo of academicData) {
        for (const institutoData of periodo.institutos) {
            for (const disciplinaData of institutoData.diciplinas) {
                for (const turmaData of disciplinaData.turmas) {
                    const turmaKey = `${periodo.ano}-${periodo.semestre}-${disciplinaData.codigo}-${turmaData.nome}`;
                    const classEntity = classesMap.get(turmaKey);
                    if (!classEntity)
                        throw new Error(`Turma não encontrada: ${turmaKey}`);

                    for (const aulaData of turmaData.aulas) {
                        const dayOfWeek = dayOfWeekMap[aulaData.dia_semana];
                        if (!dayOfWeek) continue;

                        const room = roomsMap.get(aulaData.sala);
                        if (!room)
                            throw new Error(
                                `Sala não encontrada: ${aulaData.sala}`
                            );
                        allSchedules.push({
                            classId: classEntity.id,
                            roomId: room.id,
                            dayOfWeek,
                            start: aulaData.horario.inicio,
                            end: aulaData.horario.fim
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
