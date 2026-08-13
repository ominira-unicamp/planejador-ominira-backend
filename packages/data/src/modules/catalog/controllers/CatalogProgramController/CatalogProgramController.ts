import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO, {
    CatalogLanguageOperations,
    CatalogSpecializationOperations,
    CourseBlockInput,
    CourseBlockOperations
} from "#/modules/catalog/contracts/CatalogProgramInterface.js";
import catalogProgramEntity from "#/modules/catalog/controllers/CatalogProgramController/Entity.js";
import {
    catalogProgramAlreadyExistsProblem,
    catalogProgramNotFoundProblem,
    specializationNotInProgramProblem
} from "#/modules/catalog/problems/CatalogProgramProblems.js";
import { resourceNotFoundProblem } from "@pomi/api-core";
import { CourseBlockType, PrismaClient } from "@pomi/db";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/catalog-program");
authRegistry.addException("GET", "/catalog-program/:id");

type TxType = Omit<
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

export async function invalidSpecializationsForProgram(
    prisma: Pick<TxType, "specialization">,
    specializationIds: number[],
    programId: number
) {
    const uniqueIds = [...new Set(specializationIds)];
    if (uniqueIds.length === 0) return [];

    const matching = await prisma.specialization.findMany({
        where: {
            id: { in: uniqueIds },
            programId
        },
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

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const {
        query: { catalogId, programId, programCode }
    } = input;
    const catalogPrograms = await ctx.prisma.catalogProgram.findMany({
        ...catalogProgramEntity.prismaSelection,
        where: {
            ...(catalogId ? { catalogId } : {}),
            program: {
                id: programId,
                code: programCode
            }
        }
    });
    const entities = catalogPrograms.map(catalogProgramEntity.build);
    return { 200: entities };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const {
        path: { id }
    } = input;
    const catalogProgram = await ctx.prisma.catalogProgram.findUnique({
        ...catalogProgramEntity.prismaSelection,
        where: { id }
    });
    if (!catalogProgram) return { 404: catalogProgramNotFoundProblem() };
    return { 200: catalogProgramEntity.build(catalogProgram) };
};

async function createCourseBlocks(
    tx: TxType,
    blocks: CourseBlockInput[],
    parentId: {
        catalogProgramId?: number;
        catalogSpecializationId?: number;
        catalogLanguageId?: number;
    }
) {
    const { catalogProgramId, catalogSpecializationId, catalogLanguageId } =
        parentId;
    for (const block of blocks) {
        const courseBlock = await tx.courseBlock.create({
            data: {
                type: block.type,
                credits: block.credits,
                catalogProgramId,
                catalogSpecializationId,
                catalogLanguageId
            }
        });

        if (block.requirements && block.requirements.length > 0) {
            await tx.courseRequirement.createMany({
                data: block.requirements.map((req) => ({
                    courseBlockId: courseBlock.id,
                    type: req.type,
                    courseId: req.courseId,
                    prefixId: req.prefixId
                }))
            });
        }
    }
}

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;

    const catalog = await ctx.prisma.catalog.findUnique({
        where: { id: body.catalogId }
    });
    if (!catalog) {
        return {
            404: resourceNotFoundProblem(
                "O catálogo informado não foi encontrado."
            )
        };
    }

    const program = await ctx.prisma.program.findUnique({
        where: { id: body.programId }
    });
    if (!program) {
        return {
            404: resourceNotFoundProblem(
                "O programa informado não foi encontrado."
            )
        };
    }

    const alreadyExists = await ctx.prisma.catalogProgram.findUnique({
        where: {
            catalogId_programId: {
                catalogId: catalog.id,
                programId: program.id
            }
        },
        select: { id: true }
    });
    if (alreadyExists) {
        return {
            409: catalogProgramAlreadyExistsProblem(
                { id: catalog.id, year: catalog.year },
                { id: program.id, code: program.code, name: program.name }
            )
        };
    }

    if (body.catalogSpecializations) {
        const invalidSpecializations = await invalidSpecializationsForProgram(
            ctx.prisma,
            body.catalogSpecializations.map(
                ({ specializationId }) => specializationId
            ),
            body.programId
        );
        if (invalidSpecializations.length > 0) {
            return {
                422: specializationNotInProgramProblem(
                    { id: program.id, code: program.code, name: program.name },
                    invalidSpecializations.map((specialization, index) => ({
                        ...specialization,
                        path: [
                            "body",
                            "catalogSpecializations",
                            String(index),
                            "specializationId"
                        ]
                    }))
                )
            };
        }
    }

    const catalogProgram = await ctx.prisma.$transaction(async (tx) => {
        const catalogProgram = await tx.catalogProgram.create({
            data: {
                catalogId: body.catalogId,
                programId: body.programId
            }
        });

        if (body.courseBlocks) {
            await createCourseBlocks(tx, body.courseBlocks, {
                catalogProgramId: catalogProgram.id
            });
        }

        if (body.catalogSpecializations) {
            for (const spec of body.catalogSpecializations) {
                const catalogSpec = await tx.catalogSpecialization.create({
                    data: {
                        catalogProgramId: catalogProgram.id,
                        specializationId: spec.specializationId
                    }
                });

                if (spec.courseBlocks) {
                    await createCourseBlocks(tx, spec.courseBlocks, {
                        catalogSpecializationId: catalogSpec.id
                    });
                }
            }
        }

        if (body.catalogLanguages) {
            for (const lang of body.catalogLanguages) {
                const catalogLang = await tx.catalogLanguage.create({
                    data: {
                        catalogProgramId: catalogProgram.id,
                        languageId: lang.languageId
                    }
                });

                if (lang.courseBlocks) {
                    await createCourseBlocks(tx, lang.courseBlocks, {
                        catalogLanguageId: catalogLang.id
                    });
                }
            }
        }

        return await tx.catalogProgram.findUniqueOrThrow({
            ...catalogProgramEntity.prismaSelection,
            where: { id: catalogProgram.id }
        });
    });

    return { 201: catalogProgramEntity.build(catalogProgram) };
};

async function patchCourseBlocks(
    tx: TxType,
    ops: CourseBlockOperations,
    catalogProgramId?: number,
    catalogSpecializationId?: number,
    catalogLanguageId?: number
) {
    const whereClause = {
        catalogProgramId: catalogProgramId ?? undefined,
        catalogSpecializationId: catalogSpecializationId ?? undefined,
        catalogLanguageId: catalogLanguageId ?? undefined
    };

    if (ops.set) {
        await tx.courseBlock.deleteMany({ where: whereClause });
        await createCourseBlocks(tx, ops.set, {
            catalogProgramId,
            catalogSpecializationId,
            catalogLanguageId
        });
        return;
    }

    if (ops.remove) {
        for (const id of ops.remove) {
            await tx.courseBlock.delete({ where: { id } });
        }
    }

    if (ops.add) {
        await createCourseBlocks(tx, ops.add, {
            catalogProgramId,
            catalogSpecializationId,
            catalogLanguageId
        });
    }

    if (ops.upsert) {
        for (const block of ops.upsert) {
            if (block.id) {
                await tx.courseBlock.update({
                    where: { id: block.id },
                    data: {
                        type: block.type,
                        credits: block.credits
                    }
                });
                await tx.courseRequirement.deleteMany({
                    where: { courseBlockId: block.id }
                });
                if (block.requirements && block.requirements.length > 0) {
                    await tx.courseRequirement.createMany({
                        data: block.requirements.map((req) => ({
                            courseBlockId: block.id!,
                            type: req.type,
                            courseId: req.courseId,
                            prefixId: req.prefixId
                        }))
                    });
                }
            } else {
                await createCourseBlocks(tx, [block], {
                    catalogProgramId,
                    catalogSpecializationId,
                    catalogLanguageId
                });
            }
        }
    }

    if (ops.update) {
        for (const block of ops.update) {
            const updateData: {
                type?: CourseBlockType;
                credits?: number | null;
            } = {};
            if (block.type !== undefined) updateData.type = block.type;
            if (block.credits !== undefined) updateData.credits = block.credits;

            await tx.courseBlock.update({
                where: { id: block.id },
                data: updateData
            });

            if (block.requirements) {
                await tx.courseRequirement.deleteMany({
                    where: { courseBlockId: block.id }
                });
                if (block.requirements.length > 0) {
                    await tx.courseRequirement.createMany({
                        data: block.requirements.map((req) => ({
                            courseBlockId: block.id,
                            type: req.type,
                            courseId: req.courseId,
                            prefixId: req.prefixId
                        }))
                    });
                }
            }
        }
    }
}

async function patchCatalogSpecializations(
    tx: TxType,
    ops: CatalogSpecializationOperations,
    catalogProgramId: number
) {
    if (ops.set) {
        await tx.catalogSpecialization.deleteMany({
            where: { catalogProgramId }
        });
        for (const spec of ops.set) {
            const catalogSpec = await tx.catalogSpecialization.create({
                data: {
                    catalogProgramId,
                    specializationId: spec.specializationId
                }
            });
            if (spec.courseBlocks) {
                await createCourseBlocks(tx, spec.courseBlocks, {
                    catalogSpecializationId: catalogSpec.id
                });
            }
        }
        return;
    }

    if (ops.remove) {
        for (const id of ops.remove) {
            await tx.catalogSpecialization.delete({ where: { id } });
        }
    }

    if (ops.add) {
        for (const spec of ops.add) {
            const catalogSpec = await tx.catalogSpecialization.create({
                data: {
                    catalogProgramId,
                    specializationId: spec.specializationId
                }
            });
            if (spec.courseBlocks) {
                await createCourseBlocks(tx, spec.courseBlocks, {
                    catalogSpecializationId: catalogSpec.id
                });
            }
        }
    }

    if (ops.upsert) {
        for (const spec of ops.upsert) {
            // Try to find an existing catalogSpecialization by the composite unique
            const existingSpec = await tx.catalogSpecialization.findUnique({
                where: {
                    catalogProgramId_specializationId: {
                        catalogProgramId,
                        specializationId: spec.specializationId
                    }
                }
            });
            if (existingSpec) {
                await tx.catalogSpecialization.update({
                    where: {
                        catalogProgramId_specializationId: {
                            catalogProgramId,
                            specializationId: spec.specializationId
                        }
                    },
                    data: { specializationId: spec.specializationId }
                });
                if (spec.courseBlocks) {
                    await createCourseBlocks(tx, spec.courseBlocks, {
                        catalogSpecializationId: existingSpec.id
                    });
                }
            } else {
                const catalogSpec = await tx.catalogSpecialization.create({
                    data: {
                        catalogProgramId,
                        specializationId: spec.specializationId
                    }
                });
                if (spec.courseBlocks) {
                    await createCourseBlocks(tx, spec.courseBlocks, {
                        catalogSpecializationId: catalogSpec.id
                    });
                }
            }
        }
    }

    if (ops.update) {
        for (const spec of ops.update) {
            if (spec.courseBlocks) {
                const found = await tx.catalogSpecialization.findUnique({
                    where: {
                        catalogProgramId_specializationId: {
                            catalogProgramId,
                            specializationId: spec.specializationId
                        }
                    }
                });
                if (found) {
                    await patchCourseBlocks(
                        tx,
                        spec.courseBlocks,
                        undefined,
                        found.id
                    );
                }
            }
        }
    }
}

async function patchCatalogLanguages(
    tx: TxType,
    ops: CatalogLanguageOperations,
    catalogProgramId: number
) {
    if (ops.set) {
        await tx.catalogLanguage.deleteMany({ where: { catalogProgramId } });
        for (const lang of ops.set) {
            const catalogLang = await tx.catalogLanguage.create({
                data: {
                    catalogProgramId,
                    languageId: lang.languageId
                }
            });
            if (lang.courseBlocks) {
                await createCourseBlocks(tx, lang.courseBlocks, {
                    catalogLanguageId: catalogLang.id
                });
            }
        }
        return;
    }

    if (ops.remove) {
        for (const id of ops.remove) {
            await tx.catalogLanguage.delete({ where: { id } });
        }
    }

    if (ops.add) {
        for (const lang of ops.add) {
            const catalogLang = await tx.catalogLanguage.create({
                data: {
                    catalogProgramId,
                    languageId: lang.languageId
                }
            });
            if (lang.courseBlocks) {
                await createCourseBlocks(tx, lang.courseBlocks, {
                    catalogLanguageId: catalogLang.id
                });
            }
        }
    }

    if (ops.upsert) {
        for (const lang of ops.upsert) {
            const existingLang = await tx.catalogLanguage.findFirst({
                where: {
                    catalogProgramId: catalogProgramId,
                    languageId: lang.languageId
                }
            });
            if (existingLang) {
                await tx.catalogLanguage.update({
                    where: {
                        id: existingLang.id
                    },
                    data: { languageId: lang.languageId }
                });
                if (lang.courseBlocks) {
                    await createCourseBlocks(tx, lang.courseBlocks, {
                        catalogLanguageId: existingLang.id
                    });
                }
            } else {
                const catalogLang = await tx.catalogLanguage.create({
                    data: {
                        catalogProgramId,
                        languageId: lang.languageId
                    }
                });
                if (lang.courseBlocks) {
                    await createCourseBlocks(tx, lang.courseBlocks, {
                        catalogLanguageId: catalogLang.id
                    });
                }
            }
        }
    }

    if (ops.update) {
        for (const lang of ops.update) {
            if (lang.courseBlocks) {
                const found = await tx.catalogLanguage.findFirst({
                    where: {
                        catalogProgramId: catalogProgramId,
                        languageId: lang.languageId
                    }
                });
                if (found) {
                    await patchCourseBlocks(
                        tx,
                        lang.courseBlocks,
                        undefined,
                        undefined,
                        found.id
                    );
                }
            }
        }
    }
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;

    const existing = await ctx.prisma.catalogProgram.findUnique({
        where: { id }
    });

    if (!existing) return { 404: catalogProgramNotFoundProblem() };

    if (body.catalogSpecializations) {
        const invalidSpecializations = await invalidSpecializationsForProgram(
            ctx.prisma,
            specializationIdsFromOperations(body.catalogSpecializations),
            existing.programId
        );
        if (invalidSpecializations.length > 0) {
            const program = await ctx.prisma.program.findUniqueOrThrow({
                where: { id: existing.programId },
                select: { id: true, code: true, name: true }
            });
            return {
                422: specializationNotInProgramProblem(
                    program,
                    invalidSpecializations.map((specialization, index) => ({
                        ...specialization,
                        path: [
                            "body",
                            "catalogSpecializations",
                            String(index),
                            "specializationId"
                        ]
                    }))
                )
            };
        }
    }

    const catalogProgram = await ctx.prisma.$transaction(async (tx) => {
        if (body.courseBlocks) {
            await patchCourseBlocks(tx, body.courseBlocks, existing.id);
        }

        if (body.catalogSpecializations) {
            await patchCatalogSpecializations(
                tx,
                body.catalogSpecializations,
                existing.id
            );
        }

        if (body.catalogLanguages) {
            await patchCatalogLanguages(tx, body.catalogLanguages, existing.id);
        }
        return await ctx.prisma.catalogProgram.findUniqueOrThrow({
            ...catalogProgramEntity.prismaSelection,
            where: { id: existing.id }
        });
    });

    return { 200: catalogProgramEntity.build(catalogProgram) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.catalogProgram.findUnique({
        where: { id }
    });

    if (!existing) return { 404: catalogProgramNotFoundProblem() };

    await ctx.prisma.catalogProgram.delete({ where: { id: existing.id } });
    return { 204: null };
};

router.get(
    "/catalog-program",
    buildHandler(IO.list.request, IO.list.response, listFn)
);
router.get(
    "/catalog-program/:id",
    buildHandler(IO.get.request, IO.get.response, getFn)
);
router.post(
    "/catalog-program/:id",
    buildHandler(IO.create.request, IO.create.response, createFn)
);
router.patch(
    "/catalog-program/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);
router.delete(
    "/catalog-program/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function entityPath(programId: number) {
    return `/catalog-program/${programId}`;
}

function listPath() {
    return `/catalog-programs`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    }
};
