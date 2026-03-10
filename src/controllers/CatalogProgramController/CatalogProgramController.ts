import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import {
    CourseBlockType,
    PrismaClient
} from "../../../prisma/generated/client.js";
import { AuthRegistry } from "../../auth.js";
import { buildHandler, HandlerFn } from "../../BuildHandler.js";
import catalogProgramEntity from "./Entity.js";
import IO, {
    CatalogLanguageOperations,
    CatalogSpecializationOperations,
    CourseBlockInput,
    CourseBlockOperations
} from "./Interface.js";
import registry from "./OpenAPI.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/catalog/:catalogId/program/:programId");
authRegistry.addException("GET", "/catalog/:catalogId/programs");

type TxType = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const {
        path: { catalogId }
    } = input;
    const catalogPrograms = await ctx.prisma.catalogProgram.findMany({
        ...catalogProgramEntity.prismaSelection,
        where: { catalogId }
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
    if (!catalogProgram)
        return { 404: { description: "Catalog program not found" } };
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
    if (!catalog) return { 404: { description: "Catalog not found" } };

    const program = await ctx.prisma.program.findUnique({
        where: { id: body.programId }
    });
    if (!program) return { 404: { description: "Program not found" } };

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

    if (!existing) return { 404: { description: "Catalog program not found" } };

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

    if (!existing) return { 404: { description: "Catalog program not found" } };

    await ctx.prisma.catalogProgram.delete({ where: { id: existing.id } });
    return { 204: null };
};

router.get(
    "/catalog-program",
    buildHandler(IO.list.input, IO.list.output, listFn)
);
router.get(
    "/catalog-program/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);
router.post(
    "/catalog-program/:id",
    buildHandler(IO.create.input, IO.create.output, createFn)
);
router.patch(
    "/catalog-program/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);
router.delete(
    "/catalog-program/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(programId: number) {
    return `/catalog-program/${programId}`;
}

function listPath() {
    return `/catalog-programs`;
}

export default {
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    }
};
