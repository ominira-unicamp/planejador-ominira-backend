import {
    AcademicAffiliationType,
    AcademicCareer,
    AcademicPostdoctoralModality,
    AcademicRole,
    type PrismaClient
} from "../prisma/generated/client.js";

export type AcademicCareerReferenceDefinition = Readonly<{
    career: AcademicCareer;
    code: string;
    rank?: string;
    category?: string;
    progressionOrder: number;
}>;

export type AcademicPositionDefinition = Readonly<{
    canonicalKey: string;
    role: AcademicRole;
    affiliationType: AcademicAffiliationType;
    careerReference?: Pick<
        AcademicCareerReferenceDefinition,
        "career" | "code"
    >;
    postdoctoralModality?: AcademicPostdoctoralModality;
    programCode?: string;
}>;

function careerReferences(
    career: AcademicCareer,
    values: ReadonlyArray<
        Readonly<[string, string | undefined, string | undefined]>
    >
) {
    return values.map(([code, rank, category], index) => ({
        career,
        code,
        rank,
        category,
        progressionOrder: index + 1
    }));
}

export const academicCareerReferences: readonly AcademicCareerReferenceDefinition[] =
    [
        ...careerReferences(AcademicCareer.MS, [
            ["MS2", "Professor Assistente", undefined],
            ["MS3", "Professor Doutor", undefined],
            ["MS3.1", "Professor Doutor I", undefined],
            ["MS3.2", "Professor Doutor II", undefined],
            ["MS5.1", "Professor Associado I", undefined],
            ["MS5.2", "Professor Associado II", undefined],
            ["MS5.3", "Professor Associado III", undefined],
            ["MS6", "Professor Titular", undefined]
        ]),
        ...careerReferences(AcademicCareer.MA, [
            ["A", "Professor Assistente", "MA I"],
            ["B", "Professor Assistente", "MA I"],
            ["C", "Professor Assistente", "MA I"],
            ["D", "Professor Associado", "MA II"],
            ["E", "Professor Associado", "MA II"],
            ["F", "Professor Associado", "MA II"],
            ["G", "Professor Pleno", "MA III"],
            ["H", "Professor Pleno", "MA III"],
            ["I", "Professor Pleno", "MA III"]
        ]),
        ...careerReferences(AcademicCareer.MTS, [
            ["A1", "Professor Assistente", "MTS A"],
            ["A2", "Professor Assistente", "MTS A"],
            ["A3", "Professor Assistente", "MTS A"],
            ["B1", "Professor Associado", "MTS B"],
            ["B2", "Professor Associado", "MTS B"],
            ["B3", "Professor Associado", "MTS B"],
            ["B4", "Professor Associado", "MTS B"],
            ["C1", "Professor Pleno", "MTS C"],
            ["C2", "Professor Pleno", "MTS C"],
            ["C3", "Professor Pleno", "MTS C"],
            ["C4", "Professor Pleno", "MTS C"],
            ["C5", "Professor Pleno", "MTS C"]
        ]),
        ...careerReferences(AcademicCareer.MST, [
            ["A", "Professor Magistério Secundário Técnico I", undefined],
            ["B", "Professor Magistério Secundário Técnico I", undefined],
            ["C", "Professor Magistério Secundário Técnico II", undefined],
            ["D", "Professor Magistério Secundário Técnico II", undefined],
            ["E", "Professor Magistério Secundário Técnico II", undefined],
            ["F", "Professor Magistério Secundário Técnico II", undefined],
            ["G", "Professor Magistério Secundário Técnico II", undefined],
            ["H", "Professor Magistério Secundário Técnico III", undefined],
            ["I", "Professor Magistério Secundário Técnico III", undefined],
            ["J", "Professor Magistério Secundário Técnico III", undefined],
            ["L", "Professor Magistério Secundário Técnico III", undefined],
            ["M", "Professor Magistério Secundário Técnico III", undefined]
        ]),
        ...careerReferences(AcademicCareer.DEL, [
            ["A", "Docente em Ensino de Línguas I", undefined],
            ["B", "Docente em Ensino de Línguas I", undefined],
            ["C", "Docente em Ensino de Línguas I", undefined],
            ["D", "Docente em Ensino de Línguas I", undefined],
            ["E", "Docente em Ensino de Línguas II", undefined],
            ["F", "Docente em Ensino de Línguas II", undefined],
            ["G", "Docente em Ensino de Línguas II", undefined],
            ["H", "Docente em Ensino de Línguas II", undefined],
            ["I", "Docente em Ensino de Línguas III", undefined],
            ["J", "Docente em Ensino de Línguas III", undefined],
            ["L", "Docente em Ensino de Línguas III", undefined],
            ["M", "Docente em Ensino de Línguas III", undefined]
        ]),
        ...careerReferences(AcademicCareer.DEER, [
            ["L", "Docente em Educação Especial e Reabilitação III", undefined],
            ["O", "Docente em Educação Especial e Reabilitação V", undefined]
        ]),
        ...careerReferences(AcademicCareer.PQ, [
            ["III", "Pesquisador C", undefined],
            ["IV", "Pesquisador B", undefined],
            ["V", "Pesquisador A", undefined],
            ["C1", "Pesquisador C", undefined],
            ["C2", "Pesquisador C", undefined],
            ["C3", "Pesquisador C", undefined],
            ["B1", "Pesquisador B", undefined],
            ["B2", "Pesquisador B", undefined],
            ["A", "Pesquisador A", undefined]
        ])
    ];

function careerPosition(
    definition: AcademicCareerReferenceDefinition
): AcademicPositionDefinition {
    return {
        canonicalKey: `${definition.career.toLowerCase()}:${definition.code.toLowerCase()}`,
        role:
            definition.career === AcademicCareer.PQ
                ? AcademicRole.RESEARCHER
                : AcademicRole.PROFESSOR,
        affiliationType: AcademicAffiliationType.CAREER,
        careerReference: definition
    };
}

export const academicPositions: readonly AcademicPositionDefinition[] = [
    ...academicCareerReferences.map(careerPosition),
    {
        canonicalKey: "professor:collaborator",
        role: AcademicRole.PROFESSOR,
        affiliationType: AcademicAffiliationType.COLLABORATOR
    },
    {
        canonicalKey: "researcher:collaborator",
        role: AcademicRole.RESEARCHER,
        affiliationType: AcademicAffiliationType.COLLABORATOR
    },
    {
        canonicalKey: "professor:senior",
        role: AcademicRole.PROFESSOR,
        affiliationType: AcademicAffiliationType.SENIOR
    },
    {
        canonicalKey: "researcher:visiting-invited",
        role: AcademicRole.RESEARCHER,
        affiliationType: AcademicAffiliationType.VISITING_INVITED
    },
    {
        canonicalKey: "professor:visiting-specialist:01",
        role: AcademicRole.PROFESSOR,
        affiliationType: AcademicAffiliationType.VISITING_SPECIALIST,
        programCode: "01"
    },
    {
        canonicalKey: "postdoctoral:standard",
        role: AcademicRole.POSTDOCTORAL_RESEARCHER,
        affiliationType: AcademicAffiliationType.POSTDOCTORAL_PROGRAM,
        postdoctoralModality: AcademicPostdoctoralModality.STANDARD
    },
    ...["01", "02", "03"].map((programCode) => ({
        canonicalKey: `postdoctoral:om:${programCode}`,
        role: AcademicRole.POSTDOCTORAL_RESEARCHER,
        affiliationType: AcademicAffiliationType.POSTDOCTORAL_PROGRAM,
        postdoctoralModality: AcademicPostdoctoralModality.OM,
        programCode
    })),
    {
        canonicalKey: "professor:senior:ms:ms6:ps",
        role: AcademicRole.PROFESSOR,
        affiliationType: AcademicAffiliationType.SENIOR,
        careerReference: { career: AcademicCareer.MS, code: "MS6" },
        programCode: "PS"
    }
];

export function normalizeAcademicPositionLabel(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

const aliases = new Map<string, string>();

function addAlias(label: string, canonicalKey: string) {
    aliases.set(normalizeAcademicPositionLabel(label), canonicalKey);
}

for (const position of academicPositions) {
    if (!position.careerReference) continue;
    const reference = academicCareerReferences.find(
        (candidate) =>
            candidate.career === position.careerReference?.career &&
            candidate.code === position.careerReference.code
    );
    if (!reference?.rank) continue;
    const category = reference.category ? ` ${reference.category}` : "";
    addAlias(
        `${reference.code} — ${reference.rank}${category}`,
        position.canonicalKey
    );
}

addAlias("MS6 — PROF TITULAR-PS", "professor:senior:ms:ms6:ps");
addAlias("Professor Doutor", "ms:ms3");
addAlias("PROFESSOR SENIOR", "professor:senior");
addAlias("PROFESSOR COLABORADOR", "professor:collaborator");
addAlias("PESQUISADOR COLABORADOR", "researcher:collaborator");
addAlias("PESQUISADOR VISITANTE CONVIDADO", "researcher:visiting-invited");
addAlias(
    "01 — PROFESSOR ESPECIALISTA VISITANTE",
    "professor:visiting-specialist:01"
);
addAlias("POS-DOUTORANDO", "postdoctoral:standard");
for (const programCode of ["01", "02", "03"])
    addAlias(
        `${programCode} — POS-DOUTORANDO-OM`,
        `postdoctoral:om:${programCode}`
    );

export function findAcademicPositionDefinition(value: string | undefined) {
    if (!value?.trim()) return undefined;
    const canonicalKey = aliases.get(normalizeAcademicPositionLabel(value));
    return canonicalKey
        ? academicPositions.find(
              (position) => position.canonicalKey === canonicalKey
          )
        : undefined;
}

export function resolveLegacyAcademicPosition(
    input: Readonly<{
        careerCode: string | null;
        rank: string | null;
        category: string | null;
    }>
) {
    const code = input.careerCode?.replaceAll("_", ".");
    if (!code && input.rank === "PROFESSOR_SENIOR") return "professor:senior";
    if (!code && input.rank === "PROFESSOR_ASSISTENTE") return "ms:ms2";
    if (!code && input.rank === "PROFESSOR_PLENO" && input.category === "MTS_C")
        return "mts:c1";
    if (code === "MS6" && input.rank === "PROF_TITULAR_PS")
        return "professor:senior:ms:ms6:ps";
    if (code === "L" && !input.rank && !input.category) return "deer:l";
    if (code?.startsWith("MS")) return `ms:${code.toLowerCase()}`;
    if (!code) return undefined;
    if (input.rank?.startsWith("DOCENTE_ENSINO_LINGUAS"))
        return `del:${code.toLowerCase()}`;
    if (input.rank === "DOCENTE_EDUCACAO_ESPECIAL_REABILITACAO_V")
        return `deer:${code.toLowerCase()}`;
    if (input.rank?.startsWith("PROFESSOR_MAGISTERIO_SECUNDARIO_TECNICO"))
        return `mst:${code.toLowerCase()}`;
    if (input.category?.startsWith("MA_")) return `ma:${code.toLowerCase()}`;
    if (input.category?.startsWith("MTS_")) return `mts:${code.toLowerCase()}`;
    return undefined;
}

export async function synchronizeAcademicPositionCatalog(prisma: PrismaClient) {
    const referencesByKey = new Map<string, number>();
    for (const definition of academicCareerReferences) {
        const reference = await prisma.academicCareerReference.upsert({
            where: {
                career_code: {
                    career: definition.career,
                    code: definition.code
                }
            },
            create: { ...definition, active: true },
            update: { ...definition, active: true },
            select: { id: true }
        });
        referencesByKey.set(
            `${definition.career}:${definition.code}`,
            reference.id
        );
    }

    await prisma.academicCareerReference.updateMany({
        where: {
            NOT: {
                OR: academicCareerReferences.map(({ career, code }) => ({
                    career,
                    code
                }))
            }
        },
        data: { active: false }
    });

    for (const definition of academicPositions) {
        const careerReferenceId = definition.careerReference
            ? referencesByKey.get(
                  `${definition.careerReference.career}:${definition.careerReference.code}`
              )
            : undefined;
        if (definition.careerReference && !careerReferenceId)
            throw new Error(
                `Referência de carreira ausente: ${definition.canonicalKey}`
            );
        await prisma.academicPosition.upsert({
            where: { canonicalKey: definition.canonicalKey },
            create: {
                canonicalKey: definition.canonicalKey,
                role: definition.role,
                affiliationType: definition.affiliationType,
                careerReferenceId,
                postdoctoralModality: definition.postdoctoralModality,
                programCode: definition.programCode
            },
            update: {
                role: definition.role,
                affiliationType: definition.affiliationType,
                careerReferenceId,
                postdoctoralModality: definition.postdoctoralModality,
                programCode: definition.programCode
            }
        });
    }

    return {
        careerReferences: academicCareerReferences.length,
        positions: academicPositions.length
    };
}
