import {
    CourseBlockType,
    CourseRequirementType,
    Prisma,
    PrismaClient
} from "@pomi/db";
import { readFile } from "node:fs/promises";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

export type CatalogInjectionOptions = {
    transactionTimeout?: number;
    transactionMaxWait?: number;
};

type CatalogSource = {
    year: number;
    url?: string;
    programs?: ProgramDetails[];
};
type RequirementSource = {
    type: CourseRequirementType;
    code?: string;
};
type CourseBlockSource = {
    type: CourseBlockType;
    credits: number | null;
    requirements: RequirementSource[];
};
type SpecializationSource = {
    code: string;
    name: string;
    blocks: CourseBlockSource[];
};
type LanguageSource = { name: string; blocks: CourseBlockSource[] };
type ProgramSource = {
    code: number;
    name: string;
    membersUrl: string;
    curriculumUrl: string;
};
type ProgramDetails = ProgramSource & {
    unitCode: string;
    blocks: CourseBlockSource[];
    specializations: SpecializationSource[];
    languages: LanguageSource[];
};

type NativeProgram = {
    code: number;
    name: string;
    curriculum?: { url?: string };
    members?: { url?: string };
    unitCode?: string;
    blocks?: CourseBlockSource[];
    specializations?: SpecializationSource[];
    languages?: LanguageSource[];
};
type NativeCatalog = {
    year: number;
    url?: string;
    sourceUrl?: string;
    programs?: NativeProgram[];
};
type TxType = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
type CourseBlockParent = {
    catalogProgramId?: number;
    catalogSpecializationId?: number;
    catalogLanguageId?: number;
};
type CourseRequirementData = Omit<
    Prisma.CourseRequirementCreateManyInput,
    "courseBlockId"
>;

function decodeHtml(value: string) {
    const named: Record<string, string> = {
        amp: "&",
        apos: "'",
        Aacute: "Á",
        aacute: "á",
        Acirc: "Â",
        acirc: "â",
        Agrave: "À",
        agrave: "à",
        Atilde: "Ã",
        atilde: "ã",
        Auml: "Ä",
        auml: "ä",
        Ccedil: "Ç",
        ccedil: "ç",
        Eacute: "É",
        eacute: "é",
        Ecirc: "Ê",
        ecirc: "ê",
        Egrave: "È",
        egrave: "è",
        Euml: "Ë",
        euml: "ë",
        Iacute: "Í",
        iacute: "í",
        Icirc: "Î",
        icirc: "î",
        Igrave: "Ì",
        igrave: "ì",
        Iuml: "Ï",
        iuml: "ï",
        Oacute: "Ó",
        oacute: "ó",
        Ocirc: "Ô",
        ocirc: "ô",
        Ograve: "Ò",
        ograve: "ò",
        Otilde: "Õ",
        otilde: "õ",
        Ouml: "Ö",
        ouml: "ö",
        Uacute: "Ú",
        uacute: "ú",
        Ucirc: "Û",
        ucirc: "û",
        Ugrave: "Ù",
        ugrave: "ù",
        Uuml: "Ü",
        uuml: "ü",
        nbsp: " ",
        quot: '"'
    };
    return value
        .replace(/&#(x?[\da-f]+);/gi, (_, code) =>
            String.fromCodePoint(
                code.startsWith("x")
                    ? Number.parseInt(code.slice(1), 16)
                    : Number(code)
            )
        )
        .replace(/&([a-z]+);/gi, (_, name) => named[name] ?? `&${name};`);
}

function text(value: string) {
    return decodeHtml(value.replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeCatalogs(value: unknown): CatalogSource[] {
    const data = unwrapScrapeData(value);
    const source = Array.isArray(data)
        ? data
        : data &&
            typeof data === "object" &&
            Array.isArray((data as { catalogs?: unknown }).catalogs)
          ? (data as { catalogs: unknown[] }).catalogs
          : undefined;
    if (!source)
        throw new Error(
            "O arquivo de currículos deve conter uma lista de catálogos"
        );
    return source.map((catalog): CatalogSource => {
        const input = catalog as NativeCatalog;
        return {
            year: input.year,
            url: input.url ?? input.sourceUrl,
            programs: input.programs?.map(
                (program): ProgramDetails => ({
                    code: program.code,
                    name: program.name,
                    membersUrl: program.members?.url ?? "",
                    curriculumUrl: program.curriculum?.url ?? "",
                    unitCode: program.unitCode ?? "DAC",
                    blocks: program.blocks ?? [],
                    specializations: program.specializations ?? [],
                    languages: program.languages ?? []
                })
            )
        };
    });
}

function parseRequirements(tableHtml: string) {
    const requirements = new Map<string, RequirementSource>();
    for (const match of tableHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
        const code = text(match[1]).replace(/\s+/g, "").toUpperCase();
        let requirement: RequirementSource | undefined;
        if (code === "-----") requirement = { type: CourseRequirementType.any };
        else if (/^[A-Z]{2}---$/.test(code))
            requirement = {
                type: CourseRequirementType.prefix,
                code: code.slice(0, 2)
            };
        else if (/^[A-Z]{2}\d{3}$/.test(code))
            requirement = { type: CourseRequirementType.specific, code };
        if (requirement)
            requirements.set(
                `${requirement.type}:${requirement.code ?? ""}`,
                requirement
            );
    }
    return [...requirements.values()];
}

export function parseCurriculum(html: string) {
    const blocks: CourseBlockSource[] = [];
    const specializations = new Map<string, SpecializationSource>();
    const languages = new Map<string, LanguageSource>();
    let currentSpecialization: SpecializationSource | null = null;
    let currentLanguage: LanguageSource | null = null;
    let blockType: CourseBlockType | null = null;
    let electiveCredits: number | null = null;
    let languageSection = false;

    for (const token of html.matchAll(
        /<(h2|h3|p|table)\b[^>]*>([\s\S]*?)<\/\1>/gi
    )) {
        const tag = token[1].toLowerCase();
        const content = token[2];
        const contentText = text(content);

        if (tag === "h2") {
            languageSection = false;
            currentLanguage = null;
            blockType = null;
            const parsed = /^([A-Z]{2})\s*-\s*(.+)$/.exec(contentText);
            if (!parsed) {
                currentSpecialization = null;
                continue;
            }
            const [, code, name] = parsed;
            if (code === "AX" && /matrícula antes da opção/i.test(name)) {
                currentSpecialization = null;
                continue;
            }
            currentSpecialization = { code, name, blocks: [] };
            specializations.set(code, currentSpecialization);
            continue;
        }

        if (tag === "h3") {
            if (/opções por língua/i.test(contentText)) {
                languageSection = true;
                currentSpecialization = null;
                currentLanguage = null;
                blockType = CourseBlockType.mandatory;
            } else if (/disciplinas eletivas/i.test(contentText)) {
                languageSection = false;
                currentLanguage = null;
                blockType = CourseBlockType.elective;
            } else if (
                /núcleo comum|disciplinas obrigatórias/i.test(contentText)
            ) {
                languageSection = false;
                currentLanguage = null;
                blockType = CourseBlockType.mandatory;
            }
            continue;
        }

        if (tag === "p") {
            if (languageSection) {
                const name = text(
                    /<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(content)?.[1] ??
                        ""
                );
                if (name) {
                    currentLanguage = languages.get(name) ?? {
                        name,
                        blocks: []
                    };
                    languages.set(name, currentLanguage);
                }
            } else if (blockType === CourseBlockType.elective) {
                const parsedCredits = /obter\s+(\d+)\s+créditos/i.exec(
                    contentText
                );
                electiveCredits = parsedCredits
                    ? Number(parsedCredits[1])
                    : null;
            }
            continue;
        }

        if (tag !== "table" || blockType === null) continue;
        const requirements = parseRequirements(content);
        if (requirements.length === 0) continue;
        const block: CourseBlockSource = {
            type: blockType,
            credits:
                blockType === CourseBlockType.elective ? electiveCredits : null,
            requirements
        };
        if (currentLanguage) currentLanguage.blocks.push(block);
        else if (currentSpecialization)
            currentSpecialization.blocks.push(block);
        else blocks.push(block);
        if (blockType === CourseBlockType.elective) electiveCredits = null;
    }

    return {
        blocks,
        specializations: [...specializations.values()],
        languages: [...languages.values()]
    };
}

async function replaceCourseBlocks(
    tx: TxType,
    parent: CourseBlockParent,
    blocks: CourseBlockSource[],
    courseIds: Map<string, number>,
    prefixIds: Map<string, number>
) {
    await tx.courseBlock.deleteMany({ where: parent });
    const missing = new Set<string>();
    let blocksCreated = 0;
    let requirementsCreated = 0;
    for (const block of blocks) {
        const requirements = block.requirements.flatMap<CourseRequirementData>(
            (requirement): CourseRequirementData[] => {
                if (requirement.type === CourseRequirementType.any)
                    return [{ type: requirement.type }];
                if (requirement.type === CourseRequirementType.specific) {
                    const courseId = courseIds.get(requirement.code!);
                    if (courseId === undefined) {
                        missing.add(requirement.code!);
                        return [];
                    }
                    return [{ type: requirement.type, courseId }];
                }
                const prefixId = prefixIds.get(requirement.code!);
                if (prefixId === undefined) {
                    missing.add(`${requirement.code}---`);
                    return [];
                }
                return [{ type: requirement.type, prefixId }];
            }
        );
        if (requirements.length === 0) continue;
        const persisted = await tx.courseBlock.create({
            data: {
                type: block.type,
                credits: block.credits,
                ...parent
            },
            select: { id: true }
        });
        await tx.courseRequirement.createMany({
            data: requirements.map((requirement) => ({
                ...requirement,
                courseBlockId: persisted.id
            }))
        });
        blocksCreated += 1;
        requirementsCreated += requirements.length;
    }
    return { blocksCreated, requirementsCreated, missing };
}

async function importCatalog(
    prisma: PrismaClient,
    source: CatalogSource,
    courseIds: Map<string, number>,
    prefixIds: Map<string, number>,
    options: Required<
        Pick<
            CatalogInjectionOptions,
            "transactionTimeout" | "transactionMaxWait"
        >
    >,
    changes: Parameters<InjectionContext["logger"]["change"]>[0][]
) {
    const programs = source.programs ?? [];
    if (programs.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa foi encontrado; ignorando.`
        );
        return;
    }

    const details = programs;
    if (details.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa pôde ser importado; ignorando.`
        );
        return;
    }
    const result = await prisma.$transaction(
        async (tx) => {
            const existingCatalog = await tx.catalog.findFirst({
                where: { year: source.year }
            });
            const catalog =
                existingCatalog ??
                (await tx.catalog.create({ data: { year: source.year } }));
            if (!existingCatalog)
                changes.push({
                    entity: "Catalog",
                    operation: "create",
                    key: { id: catalog.id, year: source.year }
                });
            let programsLinked = 0;
            let specializationsLinked = 0;
            let languagesLinked = 0;
            let blocksCreated = 0;
            let requirementsCreated = 0;
            const missingRequirements = new Set<string>();
            const accountBlocks = (
                result: Awaited<ReturnType<typeof replaceCourseBlocks>>
            ) => {
                blocksCreated += result.blocksCreated;
                requirementsCreated += result.requirementsCreated;
                for (const missing of result.missing)
                    missingRequirements.add(missing);
            };
            for (const program of details) {
                const existingProgram = await tx.program.findUnique({
                    where: { code: program.code },
                    select: { id: true, name: true, unitId: true }
                });
                const unit = await tx.unit.upsert({
                    where: { code: program.unitCode },
                    create: { code: program.unitCode },
                    update: {}
                });
                const persisted = await tx.program.upsert({
                    where: { code: program.code },
                    create: {
                        code: program.code,
                        name: program.name,
                        unitId: unit.id
                    },
                    update: { name: program.name, unitId: unit.id }
                });
                if (!existingProgram)
                    changes.push({
                        entity: "Program",
                        operation: "create",
                        key: { id: persisted.id, code: program.code }
                    });
                else {
                    const changedFields = [
                        ...(existingProgram.name !== program.name
                            ? ["name"]
                            : []),
                        ...(existingProgram.unitId !== unit.id
                            ? ["unitId"]
                            : [])
                    ];
                    if (changedFields.length > 0)
                        changes.push({
                            entity: "Program",
                            operation: "update",
                            key: { id: persisted.id, code: program.code },
                            changedFields
                        });
                }
                const catalogProgram = await tx.catalogProgram.upsert({
                    where: {
                        catalogId_programId: {
                            catalogId: catalog.id,
                            programId: persisted.id
                        }
                    },
                    create: { catalogId: catalog.id, programId: persisted.id },
                    update: {}
                });
                accountBlocks(
                    await replaceCourseBlocks(
                        tx,
                        { catalogProgramId: catalogProgram.id },
                        program.blocks,
                        courseIds,
                        prefixIds
                    )
                );
                for (const specialization of program.specializations) {
                    const persistedSpecialization =
                        await tx.specialization.upsert({
                            where: {
                                programId_code: {
                                    programId: persisted.id,
                                    code: specialization.code
                                }
                            },
                            create: {
                                programId: persisted.id,
                                code: specialization.code,
                                name: specialization.name
                            },
                            update: { name: specialization.name }
                        });
                    const catalogSpecialization =
                        await tx.catalogSpecialization.upsert({
                            where: {
                                catalogProgramId_specializationId: {
                                    catalogProgramId: catalogProgram.id,
                                    specializationId: persistedSpecialization.id
                                }
                            },
                            create: {
                                catalogProgramId: catalogProgram.id,
                                specializationId: persistedSpecialization.id
                            },
                            update: {}
                        });
                    accountBlocks(
                        await replaceCourseBlocks(
                            tx,
                            {
                                catalogSpecializationId:
                                    catalogSpecialization.id
                            },
                            specialization.blocks,
                            courseIds,
                            prefixIds
                        )
                    );
                    specializationsLinked += 1;
                }
                for (const language of program.languages) {
                    const persistedLanguage =
                        (await tx.language.findFirst({
                            where: { name: language.name }
                        })) ??
                        (await tx.language.create({
                            data: { name: language.name }
                        }));
                    const catalogLanguage = await tx.catalogLanguage.upsert({
                        where: {
                            catalogProgramId_languageId: {
                                catalogProgramId: catalogProgram.id,
                                languageId: persistedLanguage.id
                            }
                        },
                        create: {
                            catalogProgramId: catalogProgram.id,
                            languageId: persistedLanguage.id
                        },
                        update: {}
                    });
                    accountBlocks(
                        await replaceCourseBlocks(
                            tx,
                            { catalogLanguageId: catalogLanguage.id },
                            language.blocks,
                            courseIds,
                            prefixIds
                        )
                    );
                    languagesLinked += 1;
                }
                programsLinked += 1;
            }
            return {
                catalogId: catalog.id,
                programsLinked,
                specializationsLinked,
                languagesLinked,
                blocksCreated,
                requirementsCreated,
                missingRequirements: [...missingRequirements]
            };
        },
        {
            timeout: options.transactionTimeout,
            maxWait: options.transactionMaxWait
        }
    );
    if (result.missingRequirements.length > 0)
        console.warn(
            `Catálogo ${source.year}: ${result.missingRequirements.length} requisitos ausentes (${result.missingRequirements.join(", ")}); ignorados.`
        );
    console.log(
        `Catálogo ${source.year}: ${result.programsLinked} programas, ${result.specializationsLinked} especializações, ${result.languagesLinked} línguas, ${result.blocksCreated} blocos e ${result.requirementsCreated} requisitos vinculados.`
    );
}

export async function injectCatalogs(
    { prisma, inputPath, logger }: InjectionContext,
    {
        transactionTimeout = 600_000,
        transactionMaxWait = 60_000
    }: CatalogInjectionOptions = {}
) {
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");
    const [courses, prefixes] = await Promise.all([
        prisma.course.findMany({ select: { id: true, code: true } }),
        prisma.prefixes.findMany({ select: { id: true, prefix: true } })
    ]);
    const courseIds = new Map(
        courses.map((course) => [course.code.toUpperCase(), course.id])
    );
    const prefixIds = new Map(
        prefixes.map((prefix) => [prefix.prefix.toUpperCase(), prefix.id])
    );
    const catalogs = normalizeCatalogs(
        JSON.parse(await readFile(inputPath, "utf8"))
    );
    if (catalogs.length === 0)
        throw new Error("Nenhum catálogo foi encontrado na página da DAC");
    console.log(
        `Importando ${catalogs.length} catálogos: ${catalogs.map(({ year }) => year).join(", ")}`
    );
    const changes = [] as Parameters<InjectionContext["logger"]["change"]>[0][];
    for (const catalog of catalogs)
        await importCatalog(
            prisma,
            catalog,
            courseIds,
            prefixIds,
            {
                transactionTimeout,
                transactionMaxWait
            },
            changes
        );
    for (const change of changes) logger.change(change);
}
