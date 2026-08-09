import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
    CourseBlockType,
    CourseRequirementType,
    PrismaClient
} from "../prisma/generated/client.js";

dotenv.config();

const catalogsUrl =
    process.env.CATALOGS_URL ??
    "https://www.dac.unicamp.br/portal/graduacao/catalogos-de-cursos";
const firstYear = Number(process.env.CATALOG_FIRST_YEAR ?? "2021");
const lastYear = Number(
    process.env.CATALOG_LAST_YEAR ?? new Date().getFullYear()
);
const fetchConcurrency = Number(process.env.CATALOG_FETCH_CONCURRENCY ?? "6");
const transactionTimeout = Number(
    process.env.CATALOG_TRANSACTION_TIMEOUT_MS ?? "600000"
);

if (
    !Number.isInteger(firstYear) ||
    !Number.isInteger(lastYear) ||
    firstYear > lastYear
)
    throw new Error(
        "CATALOG_FIRST_YEAR e CATALOG_LAST_YEAR devem definir um intervalo válido"
    );
if (!Number.isInteger(fetchConcurrency) || fetchConcurrency < 1)
    throw new Error("CATALOG_FETCH_CONCURRENCY deve ser um inteiro positivo");
if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
    throw new Error(
        "CATALOG_TRANSACTION_TIMEOUT_MS deve ser um inteiro positivo"
    );

type CatalogSource = { year: number; url: string };
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
type TxType = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
type CourseBlockParent = {
    catalogProgramId?: number;
    catalogSpecializationId?: number;
    catalogLanguageId?: number;
};

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

async function download(url: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await fetch(url);
        if (response.ok) return response.text();
        if (response.status !== 429 || attempt === 3)
            throw new Error(`HTTP ${response.status} em ${url}`);
        await new Promise((resolve) =>
            setTimeout(resolve, 2_000 * (attempt + 1))
        );
    }
    throw new Error(`Não foi possível baixar ${url}`);
}

function parseCatalogs(html: string) {
    const found = new Map<number, CatalogSource>();
    for (const match of html.matchAll(
        /href=["']([^"']*catalogo(\d{4})\/index\.html)["']/gi
    )) {
        const year = Number(match[2]);
        if (year >= firstYear && year <= lastYear)
            found.set(year, { year, url: new URL(match[1], catalogsUrl).href });
    }
    return [...found.values()].sort((left, right) => left.year - right.year);
}

function parsePrograms(html: string, catalogUrl: string) {
    const programs: ProgramSource[] = [];
    const pattern =
        /<a\b[^>]*class=["'][^"']*\brotulo-curso\b[^"']*["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a\b[^>]*class=["'][^"']*\brotulo-curso\b|$)/gi;
    for (const match of html.matchAll(pattern)) {
        const title = text(match[1]);
        const parsed = /^(\d+)\s*-\s*(.+?)\s*-\s*(?:Integral|Noturno)$/i.exec(
            title
        );
        const coursePage =
            /href=["']([^"']*\/cursos\/[^"']+\/index\.html)["']/i.exec(
                match[2]
            );
        if (!parsed || !coursePage) continue;
        programs.push({
            code: Number(parsed[1]),
            name: parsed[2].trim(),
            membersUrl: new URL(
                coursePage[1].replace(/index\.html$/, "membros.html"),
                catalogUrl
            ).href,
            curriculumUrl: new URL(
                coursePage[1].replace(/index\.html$/, "curriculo.html"),
                catalogUrl
            ).href
        });
    }
    return programs;
}

function parseUnitCode(html: string) {
    const unitCode = Array.from(
        html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),
        (match) => /-\s*([A-Z][A-Z0-9]{1,9})\s*$/.exec(text(match[1]))?.[1]
    ).find((code) => code !== undefined);
    if (!unitCode)
        throw new Error("sigla da unidade não encontrada na página de membros");
    return unitCode;
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

async function programDetails(program: ProgramSource): Promise<ProgramDetails> {
    try {
        const [membersHtml, curriculumHtml] = await Promise.all([
            download(program.membersUrl),
            download(program.curriculumUrl)
        ]);
        const curriculum = parseCurriculum(curriculumHtml);
        return {
            ...program,
            unitCode: parseUnitCode(membersHtml),
            ...curriculum
        };
    } catch (error) {
        throw new Error(`programa ${program.code} (${program.name}): ${error}`);
    }
}

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
        const requirements = block.requirements.flatMap((requirement) => {
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
        });
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
    prefixIds: Map<string, number>
) {
    const programs = parsePrograms(await download(source.url), source.url);
    if (programs.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa foi encontrado; ignorando.`
        );
        return;
    }

    const resolvedDetails = await mapWithConcurrency(
        programs,
        fetchConcurrency,
        async (program) => {
            try {
                return await programDetails(program);
            } catch (error) {
                console.warn(
                    `Catálogo ${source.year}: programa ${program.code} (${program.name}) ignorado: ${error}`
                );
                return null;
            }
        }
    );
    const details = resolvedDetails.filter(
        (program): program is ProgramDetails => program !== null
    );
    if (details.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa pôde ser importado; ignorando.`
        );
        return;
    }
    const result = await prisma.$transaction(
        async (tx) => {
            const catalog =
                (await tx.catalog.findFirst({
                    where: { year: source.year }
                })) ??
                (await tx.catalog.create({ data: { year: source.year } }));
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
        { timeout: transactionTimeout, maxWait: 60_000 }
    );
    if (result.missingRequirements.length > 0)
        console.warn(
            `Catálogo ${source.year}: ${result.missingRequirements.length} requisitos ausentes (${result.missingRequirements.join(", ")}); ignorados.`
        );
    console.log(
        `Catálogo ${source.year}: ${result.programsLinked} programas, ${result.specializationsLinked} especializações, ${result.languagesLinked} línguas, ${result.blocksCreated} blocos e ${result.requirementsCreated} requisitos vinculados.`
    );
}

async function main() {
    const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter: pool });
    try {
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
        const catalogs = parseCatalogs(await download(catalogsUrl));
        if (catalogs.length === 0)
            throw new Error("Nenhum catálogo foi encontrado na página da DAC");
        console.log(
            `Importando ${catalogs.length} catálogos: ${catalogs.map(({ year }) => year).join(", ")}`
        );
        for (const catalog of catalogs)
            await importCatalog(prisma, catalog, courseIds, prefixIds);
    } finally {
        await prisma.$disconnect();
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
    main().catch((error: unknown) => {
        console.error("Falha na importação dos catálogos:", error);
        process.exitCode = 1;
    });
