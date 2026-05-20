/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaPg } from "@prisma/adapter-pg";
import { create } from "domain";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { DayOfWeek, PrismaClient } from "./generated/client.js";

dotenv.config();
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
// Interface para uma disciplina (reutilizada em várias partes)
interface Disciplina {
    id: string; // Código da disciplina (ex: "MU049")
    carga: string; // Carga horária em horas (ex: "30")
    cred: string; // Número de créditos (ex: "2")
    name: string; // Nome da disciplina (ex: "Introdução à Pesquisa")
}

// Seção de línguas (contém um título e uma lista de disciplinas)
interface LinguaSection {
    title: string; // Título da seção (ex: "Línguas Estrangeiras")
    data: Disciplina[];
}

// Grupo de disciplinas eletivas (título, créditos necessários e lista de disciplinas)
interface EletivasGroup {
    title: string; // Título do grupo (ex: "Optativas Livres")
    cred: string; // Créditos do grupo (ex: "8")
    data: Disciplina[];
}

// Modalidade/especialização do curso
interface Modalidade {
    codigo: string; // Código da modalidade (ex: "CB")
    title: string; // Nome da modalidade (ex: "Contrabaixo")
    data: Disciplina[]; // Disciplinas específicas da modalidade
    eletivas: EletivasGroup[]; // Lista de grupos de eletivas
}

// Curso propriamente dito
interface Curso {
    numero: number; // Número/código do curso (ex: 22)
    name: string; // Nome do curso (ex: "Música")
    maxcred: number; // Máximo de créditos do curso (ex: 0)
    obrigarorias: Disciplina[]; // Lista de disciplinas obrigatórias (atenção: 'obrigarorias' conforme schema)
    lingua: LinguaSection[]; // Lista de seções de língua/idioma
    modalidades: Modalidade[]; // Lista de modalidades/especializações
}

// Interface raiz do catálogo
interface CatalogoCursos {
    cursos: Curso[];
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
    console.log("🌱 Iniciando seeding...");

    const seedDataPath = join(__dirname, "seed-catalogo.json");
    const seedDataRaw = readFileSync(seedDataPath, "utf-8");
    const seedData: CatalogoCursos = JSON.parse(seedDataRaw);

    console.log("🗑️  Limpando dados existentes...");
    await prisma.curriculum.deleteMany();
    await prisma.curriculumCourse.deleteMany();
    await prisma.student.deleteMany();
    await prisma.catalogProgram.deleteMany();
    await prisma.catalog.deleteMany();
    await prisma.program.deleteMany();
    await prisma.specialization.deleteMany();
    await prisma.prefixes.deleteMany();
    try {
        await prisma.institute.create({
            data: {
                id: 0,
                code: "XX"
            }
        });
    } catch (e) {
        if (
            e instanceof Error &&
            e.message.includes("Unique constraint failed")
        ) {
            console.warn(`⚠️  Instituto com id 0 já existe. Pulando inserção.`);
        } else {
            console.error(`❌ Erro ao inserir instituto com id 0:`, e);
            throw e;
        }
    }
    const catalog = await prisma.catalog.create({
        data: {
            id: 1,
            year: 2026
        }
    });
    const createdPrograms = await prisma.program.createManyAndReturn({
        data: seedData.cursos.map((program) => ({
            name: program.name,
            code: program.numero,
            instituteId: 0
        }))
    });

    const mapProgramCodeToId: Record<number, number> = createdPrograms.reduce(
        (acc, program) => {
            acc[program.code] = program.id;
            return acc;
        },
        {} as Record<number, number>
    );
    const mapProgramIdToCode: Record<number, number> = createdPrograms.reduce(
        (acc, program) => {
            acc[program.id] = program.code;
            return acc;
        },
        {} as Record<number, number>
    );
    const speciaizatoinsData = seedData.cursos.flatMap((program) =>
        program.modalidades.map((modalidade) => ({
            name: modalidade.title,
            code: modalidade.codigo,
            programId: mapProgramCodeToId[program.numero]
        }))
    );
    const createdSpecializations =
        await prisma.specialization.createManyAndReturn({
            data: speciaizatoinsData.map((s) => ({
                name: s.name,
                code: s.code
            }))
        });

    const mapSpecializationCodeToId: Record<string, number> =
        createdSpecializations.reduce(
            (acc, specialization) => {
                acc[specialization.code] = specialization.id;
                return acc;
            },
            {} as Record<string, number>
        );

    const languages = Array.from(
        new Set(
            seedData.cursos.flatMap((program) =>
                program.lingua.map((lingua) => lingua.title)
            )
        )
    );

    const createdLanguages = await prisma.language.createManyAndReturn({
        data: languages.map((name) => ({ name }))
    });
    const mapLanguageTitleToId: Record<string, number> =
        createdLanguages.reduce(
            (acc, language) => {
                acc[language.name] = language.id;
                return acc;
            },
            {} as Record<string, number>
        );

    const createdCatalogPrograms =
        await prisma.catalogProgram.createManyAndReturn({
            data: seedData.cursos.map((program) => ({
                catalogId: catalog.id,
                programId: mapProgramCodeToId[program.numero]
            }))
        });
    const mapPrgramIdToCatalogProgramId: Record<number, number> =
        createdCatalogPrograms.reduce(
            (acc, cp) => {
                acc[cp.programId] = cp.id;
                return acc;
            },
            {} as Record<number, number>
        );
    const createdCatalogSpecializations =
        await prisma.catalogSpecialization.createManyAndReturn({
            data: speciaizatoinsData.map((s) => ({
                catalogProgramId: mapPrgramIdToCatalogProgramId[s.programId],
                specializationId: mapSpecializationCodeToId[s.code]
            }))
        });
    const mapSpecializationIdToCatalogSpecializationId: Record<number, number> =
        createdCatalogSpecializations.reduce(
            (acc, cs) => {
                acc[cs.specializationId] = cs.id;
                return acc;
            },
            {} as Record<number, number>
        );
    const createdCatalogLanguages =
        await prisma.catalogLanguage.createManyAndReturn({
            data: seedData.cursos.flatMap((program) =>
                program.lingua.map((lingua) => ({
                    catalogProgramId:
                        mapPrgramIdToCatalogProgramId[program.numero],
                    languageId: mapLanguageTitleToId[lingua.title]
                }))
            )
        });
    type courseBlockType = "mandatory" | "elective";
    type courseBlockDataType = {
        type: courseBlockType;
        credits?: number | null;
        catalogProgramId: number | null;
        catalogSpecializationId: number | null;
        catalogLanguageId: number | null;
        disciplinas: Disciplina[];
    };
    const courseBlocks: courseBlockDataType[] = seedData.cursos.flatMap(
        (program) => {
            const programId = mapProgramCodeToId[program.numero];
            const catalogProgramId = mapPrgramIdToCatalogProgramId[programId];

            return [
                {
                    type: "mandatory" as courseBlockType,
                    credits: null,
                    catalogProgramId,
                    catalogSpecializationId: null,
                    catalogLanguageId: null,
                    disciplinas: program.obrigarorias
                },
                ...program.modalidades.flatMap((modalidade) => {
                    const specializationId =
                        mapSpecializationCodeToId[modalidade.codigo];
                    const catalogSpecializationId =
                        mapSpecializationIdToCatalogSpecializationId[
                            specializationId
                        ];

                    return [
                        {
                            type: "mandatory" as courseBlockType,
                            credits: null,
                            catalogProgramId: null,
                            catalogSpecializationId,
                            catalogLanguageId: null,
                            disciplinas: modalidade.data
                        },
                        ...modalidade.eletivas.flatMap((eletiva) => ({
                            type: "elective" as courseBlockType,
                            credits: parseInt(eletiva.cred),
                            catalogProgramId: null,
                            catalogSpecializationId,
                            catalogLanguageId: null,
                            disciplinas: eletiva.data
                        }))
                    ];
                }),
                ...program.lingua.flatMap((lingua) => {
                    const languageId = mapLanguageTitleToId[lingua.title];
                    return {
                        type: "mandatory" as courseBlockType,
                        credits: null,
                        catalogProgramId: null,
                        catalogSpecializationId: null,
                        catalogLanguageId: languageId,
                        disciplinas: lingua.data
                    };
                })
            ];
        }
    );
    const createdCourseBlocks = await prisma.courseBlock.createManyAndReturn({
        data: courseBlocks.map((cb) => ({
            type: cb.type,
            credits: cb.credits,
            catalogProgramId: cb.catalogProgramId,
            catalogSpecializationId: cb.catalogSpecializationId,
            catalogLanguageId: cb.catalogLanguageId
        }))
    });
    const creatingCourses = courseBlocks.reduce(
        (acc, cb, index) => {
            const courseBlockId = createdCourseBlocks[index].id;
            const coursesData = cb.disciplinas.map((d) => ({
                code: d.id.trim(),
                name: d.name.trim(),
                credits: parseInt(d.cred),
                instituteId: 0
            }));
            return [...acc, ...coursesData];
        },
        [] as Array<{
            code: string;
            name: string;
            credits: number;
            instituteId: number;
        }>
    );
    const beforeCourses = await prisma.course.findMany();
    const existingCourseCodes = new Set(beforeCourses.map((c) => c.code));
    for (const course of creatingCourses) {
        try {
            if (course.code.substring(4, 5) === "-") continue;
            if (existingCourseCodes.has(course.code)) {
                continue;
            }
            await prisma.course.create({
                data: course
            });
        } catch (e) {
            if (
                e instanceof Error &&
                e.message.includes("Unique constraint failed")
            ) {
                console.warn(
                    `⚠️  Curso com código ${course.code} já existe. Pulando inserção.`
                );
            } else {
                console.error(
                    `❌ Erro ao inserir curso com código ${course.code}:`,
                    e
                );
                throw e;
            }
        }
    }
    const courses = await prisma.course.findMany();
    const mapCourseCodeToId: Record<string, number> = courses.reduce(
        (acc, course) => {
            acc[course.code] = course.id;
            return acc;
        },
        {} as Record<string, number>
    );
    const prefixes = Array.from(
        new Set(courses.map((c) => c.code.substring(0, 2)))
    ).map((prefix) => ({ prefix, instituteId: 0 }));
    const createdPrefixes = await prisma.prefixes.createManyAndReturn({
        data: prefixes
    });
    const mapPrefixToId: Record<string, number> = createdPrefixes.reduce(
        (acc, prefix) => {
            acc[prefix.prefix] = prefix.id;
            return acc;
        },
        {} as Record<string, number>
    );
    type RequirimentTypes = "any" | "prefix" | "specific";
    type RequirimentDataType = {
        courseBlockId: number;
        type: RequirimentTypes;
        courseId: number | null;
        prefixId: number | null;
    };
    const requiriments: RequirimentDataType[] = [];
    for (let i = 0; i < createdCourseBlocks.length; i++) {
        const createdBlock = createdCourseBlocks[i];
        const blockData = courseBlocks[i];

        for (const disciplina of blockData.disciplinas) {
            let reqType: RequirimentTypes = "specific";
            let prefixId: number | null = null;
            let courseId: number | null = null;
            if (disciplina.name === "-----") {
                reqType = "any";
            } else if (disciplina.name.substring(2, 5) === "---") {
                reqType = "prefix";
                prefixId = mapPrefixToId[disciplina.name.substring(0, 2)];
            } else {
                reqType = "specific";
                courseId = mapCourseCodeToId[disciplina.id];
            }
            requiriments.push({
                courseBlockId: createdBlock.id,
                type: reqType,
                courseId: courseId,
                prefixId: prefixId
            });
        }
    }
    await prisma.courseRequirement.createMany({
        data: requiriments
    });

    //console.log(catalog);
    //console.log(createdPrograms);
    //console.log(createdCatalogPrograms);
    console.log("📚 Inserindo dados do catálogo de cursos...");
    console.log("\n✨ Seeding concluído com sucesso!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Erro durante seeding:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
