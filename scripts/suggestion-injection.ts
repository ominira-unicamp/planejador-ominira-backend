import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
    CurriculumSuggestionType,
    PrismaClient
} from "../prisma/generated/client.js";

dotenv.config();

const defaultInput = resolve(
    import.meta.dirname,
    "../../scrapper/sugestao_curriculo.json"
);
const inputPath = resolve(process.env.SUGGESTION_INPUT ?? defaultInput);
const transactionTimeout = Number(
    process.env.SUGGESTION_TRANSACTION_TIMEOUT_MS ?? "120000"
);
const transactionMaxWait = Number(
    process.env.SUGGESTION_TRANSACTION_MAX_WAIT_MS ?? "60000"
);
if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
    throw new Error(
        "SUGGESTION_TRANSACTION_TIMEOUT_MS deve ser um inteiro positivo"
    );
if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
    throw new Error(
        "SUGGESTION_TRANSACTION_MAX_WAIT_MS deve ser um inteiro positivo"
    );

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
type CatalogProgramLookup = {
    id: number;
    specializations: Map<string, number>;
};

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

function normalizeCode(code: string) {
    return code.replace(/\s+/g, "").toUpperCase();
}

function normalizeSuggestion(suggestion: SuggestionInput) {
    const [rawCode, ...nameParts] = suggestion.name.split(" - ");
    const code = normalizeCode(suggestion.code ?? rawCode);
    const name =
        suggestion.code && normalizeCode(rawCode) !== code
            ? suggestion.name
            : nameParts.join(" - ");
    if (!name) throw new Error(`sugestão ${code} sem nome`);
    return { code, name };
}

function isPreOptionSuggestion(code: string, name: string) {
    return (
        `${code} - ${name}`
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase() === "AX - PARA MATRICULA ANTES DA OPCAO"
    );
}

async function importSuggestion(
    catalog: CatalogInput,
    program: ProgramInput,
    suggestion: SuggestionInput,
    catalogPrograms: Map<string, CatalogProgramLookup>,
    courseIds: Map<string, number>
) {
    const catalogProgram = catalogPrograms.get(
        `${catalog.year}:${program.code}`
    );
    if (!catalogProgram) {
        console.warn(
            `[${catalog.year}] programa ${program.code}: CatalogProgram ausente; sugestão ignorada.`
        );
        return { semesters: 0, courses: 0, missingCourses: 0 };
    }

    const { code, name } = normalizeSuggestion(suggestion);

    return prisma.$transaction(
        async (tx) => {
            let type: CurriculumSuggestionType;
            let catalogSpecializationId: number | null = null;
            if (isPreOptionSuggestion(code, name)) {
                type = CurriculumSuggestionType.PRE_OPTION;
            } else {
                const matchedSpecialization =
                    catalogProgram.specializations.get(code);
                if (matchedSpecialization !== undefined) {
                    type = CurriculumSuggestionType.SPECIALIZATION;
                    catalogSpecializationId = matchedSpecialization;
                } else {
                    if (catalogProgram.specializations.size > 0)
                        throw new Error(
                            `sugestão ${code} não corresponde a uma especialização do catálogo`
                        );
                    type = CurriculumSuggestionType.GENERAL;
                }
            }
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
                    name,
                    type,
                    catalogSpecializationId
                },
                update: {
                    name,
                    type,
                    catalogSpecializationId
                },
                select: { id: true }
            });
            await tx.semesterSuggestion.deleteMany({
                where: { suggestionId: persisted.id }
            });
            await tx.semesterSuggestion.createMany({
                data: suggestion.semesters.map((semester) => ({
                    suggestionId: persisted.id,
                    semester: semester.semester,
                    electiveCredits: semester.elective_credits ?? 0
                }))
            });
            const persistedSemesters = new Map(
                (
                    await tx.semesterSuggestion.findMany({
                        where: { suggestionId: persisted.id },
                        select: { id: true, semester: true }
                    })
                ).map((semester) => [semester.semester, semester.id])
            );
            const missing = new Set<string>();
            const suggestionCourses: Array<{
                semesterSuggestionId: number;
                courseId: number;
            }> = [];
            for (const semester of suggestion.semesters) {
                const semesterSuggestionId = persistedSemesters.get(
                    semester.semester
                );
                if (semesterSuggestionId === undefined)
                    throw new Error(
                        `semestre ${semester.semester} não persistido`
                    );
                for (const inputCourse of semester.courses) {
                    const courseCode = normalizeCode(inputCourse.code);
                    const courseId = courseIds.get(courseCode);
                    if (courseId === undefined) {
                        missing.add(courseCode);
                        continue;
                    }
                    suggestionCourses.push({ semesterSuggestionId, courseId });
                }
            }
            if (suggestionCourses.length > 0)
                await tx.suggestionCourse.createMany({
                    data: suggestionCourses,
                    skipDuplicates: true
                });
            if (missing.size > 0)
                console.warn(
                    `[${catalog.year}] programa ${program.code}, sugestão ${suggestion.name}: ${missing.size} disciplinas ausentes (${[...missing].join(", ")}); ignoradas.`
                );
            return {
                semesters: suggestion.semesters.length,
                courses: suggestionCourses.length,
                missingCourses: missing.size
            };
        },
        { timeout: transactionTimeout, maxWait: transactionMaxWait }
    );
}

async function runWithConcurrency<T>(
    tasks: T[],
    concurrency: number,
    operation: (task: T) => Promise<void>
) {
    let next = 0;
    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, tasks.length) },
            async () => {
                while (next < tasks.length) {
                    const task = tasks[next];
                    next += 1;
                    await operation(task);
                }
            }
        )
    );
}

async function main() {
    const input = JSON.parse(await readFile(inputPath, "utf8")) as Input;
    const persistedCatalogPrograms = await prisma.catalogProgram.findMany({
        select: {
            id: true,
            catalog: { select: { year: true } },
            program: { select: { code: true } },
            catalogSpecializations: {
                select: {
                    id: true,
                    specialization: { select: { code: true } }
                }
            }
        }
    });
    const catalogPrograms = new Map(
        persistedCatalogPrograms.map((catalogProgram) => [
            `${catalogProgram.catalog.year}:${catalogProgram.program.code}`,
            {
                id: catalogProgram.id,
                specializations: new Map(
                    catalogProgram.catalogSpecializations.map((item) => [
                        normalizeCode(item.specialization.code),
                        item.id
                    ])
                )
            }
        ])
    );
    const requestedCourseCodes = [
        ...new Set(
            input.catalogs.flatMap((catalog) =>
                catalog.programs.flatMap((program) =>
                    program.suggestions.flatMap((suggestion) =>
                        suggestion.semesters.flatMap((semester) =>
                            semester.courses.map(({ code }) =>
                                normalizeCode(code)
                            )
                        )
                    )
                )
            )
        )
    ];
    const courseIds = new Map(
        (
            await prisma.course.findMany({
                where: { code: { in: requestedCourseCodes } },
                select: { id: true, code: true }
            })
        ).map((course) => [course.code, course.id])
    );
    const tasks = input.catalogs.flatMap((catalog) =>
        catalog.programs.flatMap((program) =>
            program.suggestions.map((suggestion) => ({
                catalog,
                program,
                suggestion
            }))
        )
    );
    const concurrency = Number(
        process.env.SUGGESTION_INJECTION_CONCURRENCY ?? "4"
    );
    if (!Number.isInteger(concurrency) || concurrency < 1)
        throw new Error(
            "SUGGESTION_INJECTION_CONCURRENCY deve ser um inteiro positivo"
        );
    let importedSuggestions = 0;
    let importedCourses = 0;
    let missingCourses = 0;
    await runWithConcurrency(
        tasks,
        concurrency,
        async ({ catalog, program, suggestion }) => {
            try {
                const result = await importSuggestion(
                    catalog,
                    program,
                    suggestion,
                    catalogPrograms,
                    courseIds
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
    );
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
