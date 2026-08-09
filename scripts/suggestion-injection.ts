import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "../prisma/generated/client.js";

dotenv.config();

const defaultInput = resolve(
    import.meta.dirname,
    "../../scrapper/sugestao_curriculo.json"
);
const inputPath = resolve(process.env.SUGGESTION_INPUT ?? defaultInput);

type CourseInput = { code: string };
type SemesterInput = {
    semester: number;
    elective_credits?: number;
    courses: CourseInput[];
};
type SuggestionInput = {
    code?: string;
    name: string;
    semesters: SemesterInput[];
};
type ProgramInput = {
    code: number;
    suggestions: SuggestionInput[];
};
type CatalogInput = { year: number; programs: ProgramInput[] };
type Input = { catalogs: CatalogInput[] };

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

function normalizeCode(code: string) {
    return code.replace(/\s+/g, "").toUpperCase();
}

async function importSuggestion(
    catalog: CatalogInput,
    program: ProgramInput,
    suggestion: SuggestionInput
) {
    const catalogProgram = await prisma.catalogProgram.findFirst({
        where: {
            catalog: { year: catalog.year },
            program: { code: program.code }
        },
        select: { id: true }
    });
    if (!catalogProgram) {
        console.warn(
            `[${catalog.year}] programa ${program.code}: CatalogProgram ausente; sugestão ignorada.`
        );
        return { semesters: 0, courses: 0, missingCourses: 0 };
    }

    const code = suggestion.code ?? suggestion.name.split(" - ", 1)[0];

    return prisma.$transaction(async (tx) => {
        const persisted = await tx.curriculumSuggestion.upsert({
            where: {
                catalogProgramId_code: {
                    catalogProgramId: catalogProgram.id,
                    code
                }
            },
            create: {
                catalogProgramId: catalogProgram.id,
                code,
                name: suggestion.name
            },
            update: {
                name: suggestion.name
            },
            select: { id: true }
        });
        let courses = 0;
        let missingCourses = 0;
        for (const semester of suggestion.semesters) {
            const persistedSemester = await tx.semesterSuggestion.upsert({
                where: {
                    suggestionId_semester: {
                        suggestionId: persisted.id,
                        semester: semester.semester
                    }
                },
                create: {
                    suggestionId: persisted.id,
                    semester: semester.semester,
                    electiveCredits: semester.elective_credits ?? 0
                },
                update: {
                    electiveCredits: semester.elective_credits ?? 0
                },
                select: { id: true }
            });
            for (const [position, inputCourse] of semester.courses.entries()) {
                const code = normalizeCode(inputCourse.code);
                const course = await tx.course.findUnique({
                    where: { code },
                    select: { id: true }
                });
                if (!course) {
                    missingCourses += 1;
                    console.warn(
                        `[${catalog.year}] programa ${program.code}, sugestão ${suggestion.name}, semestre ${semester.semester}: Course ${code} ausente; ignorado.`
                    );
                    continue;
                }
                await tx.suggestionCourse.upsert({
                    where: {
                        semesterSuggestionId_courseId: {
                            semesterSuggestionId: persistedSemester.id,
                            courseId: course.id
                        }
                    },
                    create: {
                        semesterSuggestionId: persistedSemester.id,
                        courseId: course.id,
                        position
                    },
                    update: { position }
                });
                courses += 1;
            }
        }
        return {
            semesters: suggestion.semesters.length,
            courses,
            missingCourses
        };
    });
}

async function main() {
    const input = JSON.parse(await readFile(inputPath, "utf8")) as Input;
    let importedSuggestions = 0;
    let importedCourses = 0;
    let missingCourses = 0;
    for (const catalog of input.catalogs) {
        for (const program of catalog.programs) {
            for (const suggestion of program.suggestions) {
                try {
                    const result = await importSuggestion(
                        catalog,
                        program,
                        suggestion
                    );
                    importedSuggestions += result.semesters > 0 ? 1 : 0;
                    importedCourses += result.courses;
                    missingCourses += result.missingCourses;
                } catch (error) {
                    console.warn(
                        `[${catalog.year}] programa ${program.code}, sugestão ${suggestion.code ?? suggestion.name}: importação ignorada: ${error}`
                    );
                }
            }
        }
    }
    console.log(
        JSON.stringify(
            { importedSuggestions, importedCourses, missingCourses },
            null,
            2
        )
    );
}

main()
    .catch((error: unknown) => {
        console.error("Falha na importação das sugestões:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
