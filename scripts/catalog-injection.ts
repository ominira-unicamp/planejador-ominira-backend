import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { PrismaClient } from "../prisma/generated/client.js";

dotenv.config();

const catalogsUrl =
    process.env.CATALOGS_URL ??
    "https://www.dac.unicamp.br/portal/graduacao/catalogos-de-cursos";
const firstYear = Number(process.env.CATALOG_FIRST_YEAR ?? "2021");
const lastYear = Number(
    process.env.CATALOG_LAST_YEAR ?? new Date().getFullYear()
);

if (
    !Number.isInteger(firstYear) ||
    !Number.isInteger(lastYear) ||
    firstYear > lastYear
)
    throw new Error(
        "CATALOG_FIRST_YEAR e CATALOG_LAST_YEAR devem definir um intervalo válido"
    );

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

type CatalogSource = { year: number; url: string };
type ProgramSource = { code: number; name: string; membersUrl: string };
type ProgramDetails = ProgramSource & { unitCode: string };

function decodeHtml(value: string) {
    const named: Record<string, string> = {
        amp: "&",
        apos: "'",
        Aacute: "Á",
        aacute: "á",
        Ccedil: "Ç",
        ccedil: "ç",
        Eacute: "É",
        eacute: "é",
        Iacute: "Í",
        iacute: "í",
        Oacute: "Ó",
        oacute: "ó",
        Otilde: "Õ",
        otilde: "õ",
        Uacute: "Ú",
        uacute: "ú",
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

async function programDetails(program: ProgramSource): Promise<ProgramDetails> {
    try {
        return {
            ...program,
            unitCode: parseUnitCode(await download(program.membersUrl))
        };
    } catch (error) {
        throw new Error(`programa ${program.code} (${program.name}): ${error}`);
    }
}

async function importCatalog(source: CatalogSource) {
    const programs = parsePrograms(await download(source.url), source.url);
    if (programs.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa foi encontrado; ignorando.`
        );
        return;
    }

    const details: ProgramDetails[] = [];
    for (const program of programs) {
        try {
            details.push(await programDetails(program));
        } catch (error) {
            console.warn(
                `Catálogo ${source.year}: programa ${program.code} (${program.name}) ignorado: ${error}`
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (details.length === 0) {
        console.warn(
            `Catálogo ${source.year}: nenhum programa pôde ser importado; ignorando.`
        );
        return;
    }
    const result = await prisma.$transaction(async (tx) => {
        const catalog =
            (await tx.catalog.findFirst({ where: { year: source.year } })) ??
            (await tx.catalog.create({ data: { year: source.year } }));
        let programsLinked = 0;
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
            await tx.catalogProgram.upsert({
                where: {
                    catalogId_programId: {
                        catalogId: catalog.id,
                        programId: persisted.id
                    }
                },
                create: { catalogId: catalog.id, programId: persisted.id },
                update: {}
            });
            programsLinked += 1;
        }
        return { catalogId: catalog.id, programsLinked };
    });
    console.log(
        `Catálogo ${source.year}: ${result.programsLinked} programas vinculados.`
    );
}

async function main() {
    const catalogs = parseCatalogs(await download(catalogsUrl));
    if (catalogs.length === 0)
        throw new Error("Nenhum catálogo foi encontrado na página da DAC");
    console.log(
        `Importando ${catalogs.length} catálogos: ${catalogs.map(({ year }) => year).join(", ")}`
    );
    for (const catalog of catalogs) await importCatalog(catalog);
}

main()
    .catch((error: unknown) => {
        console.error("Falha na importação dos catálogos:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
