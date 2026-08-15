import IO, {
    CatalogLanguageOperations,
    CatalogSpecializationOperations,
    CourseBlockInput,
    CourseBlockOperations
} from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import catalogProgramEntity from "#/modules/catalog/catalog-program/CatalogProgram.entity.js";
import {
    catalogProgramAlreadyExistsProblem,
    catalogProgramNotFoundProblem,
    relatedResourceNotFoundProblem,
    specializationNotInProgramProblem,
    type CatalogProgramProblem
} from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import { CourseBlockType, type PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogProgramEntity = z.infer<typeof IO.schemas.catalogProgramEntity>;

export type CatalogProgramListInput = {
    catalogId?: number;
    programId?: number;
    programCode?: number;
};

export type CreateCatalogProgramInput = {
    catalogId: number;
    programId: number;
    courseBlocks?: CourseBlockInput[];
    catalogSpecializations?: Array<{
        specializationId: number;
        courseBlocks?: CourseBlockInput[];
    }>;
    catalogLanguages?: Array<{
        languageId: number;
        courseBlocks?: CourseBlockInput[];
    }>;
};

export type PatchCatalogProgramInput = {
    courseBlocks?: CourseBlockOperations;
    catalogSpecializations?: CatalogSpecializationOperations;
    catalogLanguages?: CatalogLanguageOperations;
};

export type CatalogProgramService = {
    list(input: CatalogProgramListInput): Promise<CatalogProgramEntity[]>;
    getById(
        id: number
    ): Promise<Result<CatalogProgramEntity, CatalogProgramProblem>>;
    create(
        input: CreateCatalogProgramInput
    ): Promise<Result<CatalogProgramEntity, CatalogProgramProblem>>;
    patch(
        id: number,
        input: PatchCatalogProgramInput
    ): Promise<Result<CatalogProgramEntity, CatalogProgramProblem>>;
    remove(id: number): Promise<Result<void, CatalogProgramProblem>>;
};

type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

function specializationIdsFromOperations(
    operations: CatalogSpecializationOperations
) {
    return [
        ...(operations.set ?? []),
        ...(operations.add ?? []),
        ...(operations.upsert ?? []),
        ...(operations.update ?? [])
    ].map(({ specializationId }) => specializationId);
}

type SpecializationInputReference = {
    specializationId: number;
    path: string[];
};

function specializationInputsFromOperations(
    operations: CatalogSpecializationOperations
): SpecializationInputReference[] {
    const groups = [
        { operation: "set", specializations: operations.set },
        { operation: "add", specializations: operations.add },
        { operation: "upsert", specializations: operations.upsert },
        { operation: "update", specializations: operations.update }
    ];
    return groups.flatMap(({ operation, specializations }) =>
        (specializations ?? []).map((specialization, index) => ({
            specializationId: specialization.specializationId,
            path: [
                "catalogSpecializations",
                operation,
                String(index),
                "specializationId"
            ]
        }))
    );
}

function invalidSpecializationReferences(
    specializations: Array<{ id: number; code: string; name: string }>,
    inputs: SpecializationInputReference[]
) {
    const specializationsById = new Map(
        specializations.map((specialization) => [
            specialization.id,
            specialization
        ])
    );
    return inputs.flatMap(({ specializationId, path }) => {
        const specialization = specializationsById.get(specializationId);
        return specialization ? [{ ...specialization, path }] : [];
    });
}

export async function invalidSpecializationsForProgram(
    prisma: Pick<TransactionClient, "specialization">,
    specializationIds: number[],
    programId: number
) {
    const uniqueIds = [...new Set(specializationIds)];
    if (uniqueIds.length === 0) return [];
    const matching = await prisma.specialization.findMany({
        where: { id: { in: uniqueIds }, programId },
        select: { id: true }
    });
    const matchingIds = new Set(matching.map(({ id }) => id));
    const invalidIds = uniqueIds.filter((id) => !matchingIds.has(id));
    if (invalidIds.length === 0) return [];
    return await prisma.specialization.findMany({
        where: { id: { in: invalidIds } },
        select: { id: true, code: true, name: true }
    });
}

type CourseBlockParent = {
    catalogProgramId?: number;
    catalogSpecializationId?: number;
    catalogLanguageId?: number;
};

async function createCourseBlocks(
    tx: TransactionClient,
    blocks: CourseBlockInput[],
    parent: CourseBlockParent
) {
    for (const block of blocks) {
        const courseBlock = await tx.courseBlock.create({
            data: { ...parent, type: block.type, credits: block.credits }
        });
        if (block.requirements.length > 0) {
            await tx.courseRequirement.createMany({
                data: block.requirements.map((requirement) => ({
                    courseBlockId: courseBlock.id,
                    type: requirement.type,
                    courseId: requirement.courseId,
                    prefixId: requirement.prefixId
                }))
            });
        }
    }
}

async function createCatalogProgramRelations(
    tx: TransactionClient,
    catalogProgramId: number,
    input: CreateCatalogProgramInput
) {
    if (input.courseBlocks) {
        await createCourseBlocks(tx, input.courseBlocks, { catalogProgramId });
    }
    await createCatalogSpecializations(
        tx,
        catalogProgramId,
        input.catalogSpecializations ?? []
    );
    for (const language of input.catalogLanguages ?? []) {
        const catalogLanguage = await tx.catalogLanguage.create({
            data: { catalogProgramId, languageId: language.languageId }
        });
        if (language.courseBlocks) {
            await createCourseBlocks(tx, language.courseBlocks, {
                catalogLanguageId: catalogLanguage.id
            });
        }
    }
}

async function createCatalogSpecializations(
    tx: TransactionClient,
    catalogProgramId: number,
    specializations: NonNullable<
        CreateCatalogProgramInput["catalogSpecializations"]
    >
) {
    for (const specialization of specializations) {
        const catalogSpecialization = await tx.catalogSpecialization.create({
            data: {
                catalogProgramId,
                specializationId: specialization.specializationId
            }
        });
        if (specialization.courseBlocks) {
            await createCourseBlocks(tx, specialization.courseBlocks, {
                catalogSpecializationId: catalogSpecialization.id
            });
        }
    }
}

async function replaceRequirements(
    tx: TransactionClient,
    courseBlockId: number,
    requirements: CourseBlockInput["requirements"]
) {
    await tx.courseRequirement.deleteMany({ where: { courseBlockId } });
    if (requirements.length > 0) {
        await tx.courseRequirement.createMany({
            data: requirements.map((requirement) => ({
                courseBlockId,
                type: requirement.type,
                courseId: requirement.courseId,
                prefixId: requirement.prefixId
            }))
        });
    }
}

async function patchCourseBlocks(
    tx: TransactionClient,
    operations: CourseBlockOperations,
    parent: CourseBlockParent
) {
    if (operations.set) {
        await tx.courseBlock.deleteMany({ where: parent });
        await createCourseBlocks(tx, operations.set, parent);
        return;
    }
    for (const id of operations.remove ?? []) {
        await tx.courseBlock.delete({ where: { id } });
    }
    if (operations.add) await createCourseBlocks(tx, operations.add, parent);
    for (const block of operations.upsert ?? []) {
        const courseBlock = await tx.courseBlock.update({
            where: { id: block.id },
            data: { type: block.type, credits: block.credits }
        });
        await replaceRequirements(tx, courseBlock.id, block.requirements);
    }
    for (const block of operations.update ?? []) {
        const data: { type?: CourseBlockType; credits?: number | null } = {};
        if (block.type !== undefined) data.type = block.type;
        if (block.credits !== undefined) data.credits = block.credits;
        await tx.courseBlock.update({ where: { id: block.id }, data });
        if (block.requirements !== undefined) {
            await replaceRequirements(tx, block.id, block.requirements);
        }
    }
}

async function patchCatalogSpecializations(
    tx: TransactionClient,
    operations: CatalogSpecializationOperations,
    catalogProgramId: number
) {
    if (operations.set) {
        await tx.catalogSpecialization.deleteMany({
            where: { catalogProgramId }
        });
        await createCatalogSpecializations(
            tx,
            catalogProgramId,
            operations.set
        );
        return;
    }
    for (const id of operations.remove ?? []) {
        await tx.catalogSpecialization.delete({ where: { id } });
    }
    for (const specialization of operations.add ?? []) {
        const catalogSpecialization = await tx.catalogSpecialization.create({
            data: {
                catalogProgramId,
                specializationId: specialization.specializationId
            }
        });
        if (specialization.courseBlocks) {
            await createCourseBlocks(tx, specialization.courseBlocks, {
                catalogSpecializationId: catalogSpecialization.id
            });
        }
    }
    for (const specialization of operations.upsert ?? []) {
        const catalogSpecialization = await tx.catalogSpecialization.upsert({
            where: {
                catalogProgramId_specializationId: {
                    catalogProgramId,
                    specializationId: specialization.specializationId
                }
            },
            create: {
                catalogProgramId,
                specializationId: specialization.specializationId
            },
            update: {}
        });
        if (specialization.courseBlocks) {
            await createCourseBlocks(tx, specialization.courseBlocks, {
                catalogSpecializationId: catalogSpecialization.id
            });
        }
    }
    for (const specialization of operations.update ?? []) {
        if (!specialization.courseBlocks) continue;
        const catalogSpecialization = await tx.catalogSpecialization.findUnique(
            {
                where: {
                    catalogProgramId_specializationId: {
                        catalogProgramId,
                        specializationId: specialization.specializationId
                    }
                }
            }
        );
        if (catalogSpecialization) {
            await patchCourseBlocks(tx, specialization.courseBlocks, {
                catalogSpecializationId: catalogSpecialization.id
            });
        }
    }
}

async function patchCatalogLanguages(
    tx: TransactionClient,
    operations: CatalogLanguageOperations,
    catalogProgramId: number
) {
    if (operations.set) {
        await tx.catalogLanguage.deleteMany({ where: { catalogProgramId } });
        for (const language of operations.set) {
            const catalogLanguage = await tx.catalogLanguage.create({
                data: { catalogProgramId, languageId: language.languageId }
            });
            if (language.courseBlocks) {
                await createCourseBlocks(tx, language.courseBlocks, {
                    catalogLanguageId: catalogLanguage.id
                });
            }
        }
        return;
    }
    for (const id of operations.remove ?? []) {
        await tx.catalogLanguage.delete({ where: { id } });
    }
    for (const language of operations.add ?? []) {
        const catalogLanguage = await tx.catalogLanguage.create({
            data: { catalogProgramId, languageId: language.languageId }
        });
        if (language.courseBlocks) {
            await createCourseBlocks(tx, language.courseBlocks, {
                catalogLanguageId: catalogLanguage.id
            });
        }
    }
    for (const language of operations.upsert ?? []) {
        const catalogLanguage = await tx.catalogLanguage.upsert({
            where: {
                catalogProgramId_languageId: {
                    catalogProgramId,
                    languageId: language.languageId
                }
            },
            create: { catalogProgramId, languageId: language.languageId },
            update: {}
        });
        if (language.courseBlocks) {
            await createCourseBlocks(tx, language.courseBlocks, {
                catalogLanguageId: catalogLanguage.id
            });
        }
    }
    for (const language of operations.update ?? []) {
        if (!language.courseBlocks) continue;
        const catalogLanguage = await tx.catalogLanguage.findUnique({
            where: {
                catalogProgramId_languageId: {
                    catalogProgramId,
                    languageId: language.languageId
                }
            }
        });
        if (catalogLanguage) {
            await patchCourseBlocks(tx, language.courseBlocks, {
                catalogLanguageId: catalogLanguage.id
            });
        }
    }
}

export function createCatalogProgramService({
    prisma
}: {
    prisma: PrismaClient;
}): CatalogProgramService {
    return {
        async list({ catalogId, programId, programCode }) {
            const catalogPrograms = await prisma.catalogProgram.findMany({
                ...catalogProgramEntity.prismaSelection,
                where: {
                    ...(catalogId ? { catalogId } : {}),
                    program: {
                        id: programId,
                        code: programCode
                    }
                }
            });
            return catalogPrograms.map(catalogProgramEntity.build);
        },
        async getById(id) {
            const catalogProgram = await prisma.catalogProgram.findUnique({
                ...catalogProgramEntity.prismaSelection,
                where: { id }
            });
            return catalogProgram
                ? ok(catalogProgramEntity.build(catalogProgram))
                : err(catalogProgramNotFoundProblem());
        },
        async create(input) {
            const catalog = await prisma.catalog.findUnique({
                where: { id: input.catalogId }
            });
            if (!catalog) {
                return err(
                    relatedResourceNotFoundProblem(
                        "O catálogo informado não foi encontrado."
                    )
                );
            }
            const program = await prisma.program.findUnique({
                where: { id: input.programId }
            });
            if (!program) {
                return err(
                    relatedResourceNotFoundProblem(
                        "O programa informado não foi encontrado."
                    )
                );
            }
            const existing = await prisma.catalogProgram.findUnique({
                where: {
                    catalogId_programId: {
                        catalogId: catalog.id,
                        programId: program.id
                    }
                },
                select: { id: true }
            });
            if (existing) {
                return err(
                    catalogProgramAlreadyExistsProblem(
                        { id: catalog.id, year: catalog.year },
                        {
                            id: program.id,
                            code: program.code,
                            name: program.name
                        }
                    )
                );
            }
            const catalogSpecializations = input.catalogSpecializations;
            const invalidSpecializations = catalogSpecializations
                ? await invalidSpecializationsForProgram(
                      prisma,
                      catalogSpecializations.map(
                          ({ specializationId }) => specializationId
                      ),
                      program.id
                  )
                : [];
            if (invalidSpecializations.length > 0) {
                return err(
                    specializationNotInProgramProblem(
                        {
                            id: program.id,
                            code: program.code,
                            name: program.name
                        },
                        invalidSpecializationReferences(
                            invalidSpecializations,
                            catalogSpecializations!.map(
                                ({ specializationId }, index) => ({
                                    specializationId,
                                    path: [
                                        "catalogSpecializations",
                                        String(index),
                                        "specializationId"
                                    ]
                                })
                            )
                        )
                    )
                );
            }
            const catalogProgram = await prisma.$transaction(async (tx) => {
                const created = await tx.catalogProgram.create({
                    data: {
                        catalogId: input.catalogId,
                        programId: input.programId
                    }
                });
                await createCatalogProgramRelations(tx, created.id, input);
                return await tx.catalogProgram.findUniqueOrThrow({
                    ...catalogProgramEntity.prismaSelection,
                    where: { id: created.id }
                });
            });
            return ok(catalogProgramEntity.build(catalogProgram));
        },
        async patch(id, input) {
            const existing = await prisma.catalogProgram.findUnique({
                where: { id }
            });
            if (!existing) return err(catalogProgramNotFoundProblem());
            if (input.catalogSpecializations) {
                const invalidSpecializations =
                    await invalidSpecializationsForProgram(
                        prisma,
                        specializationIdsFromOperations(
                            input.catalogSpecializations
                        ),
                        existing.programId
                    );
                if (invalidSpecializations.length > 0) {
                    const program = await prisma.program.findUniqueOrThrow({
                        where: { id: existing.programId },
                        select: { id: true, code: true, name: true }
                    });
                    return err(
                        specializationNotInProgramProblem(
                            program,
                            invalidSpecializationReferences(
                                invalidSpecializations,
                                specializationInputsFromOperations(
                                    input.catalogSpecializations
                                )
                            )
                        )
                    );
                }
            }
            const catalogProgram = await prisma.$transaction(async (tx) => {
                if (input.courseBlocks) {
                    await patchCourseBlocks(tx, input.courseBlocks, {
                        catalogProgramId: existing.id
                    });
                }
                if (input.catalogSpecializations) {
                    await patchCatalogSpecializations(
                        tx,
                        input.catalogSpecializations,
                        existing.id
                    );
                }
                if (input.catalogLanguages) {
                    await patchCatalogLanguages(
                        tx,
                        input.catalogLanguages,
                        existing.id
                    );
                }
                return await tx.catalogProgram.findUniqueOrThrow({
                    ...catalogProgramEntity.prismaSelection,
                    where: { id: existing.id }
                });
            });
            return ok(catalogProgramEntity.build(catalogProgram));
        },
        async remove(id) {
            const existing = await prisma.catalogProgram.findUnique({
                where: { id }
            });
            if (!existing) return err(catalogProgramNotFoundProblem());
            await prisma.catalogProgram.delete({ where: { id: existing.id } });
            return ok(undefined);
        }
    };
}
