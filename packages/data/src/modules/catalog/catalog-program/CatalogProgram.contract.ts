import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import {
    CatalogProgramAlreadyExistsProblemSchema,
    CatalogProgramNotFoundProblemSchema,
    SpecializationNotInProgramProblemSchema
} from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("catalog-program")];
const tags = ["catalog-program"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const CourseBlockType = {
    mandatory: "mandatory",
    elective: "elective"
} as const;

export const CourseRequirementType = {
    any: "any",
    prefix: "prefix",
    specific: "specific"
} as const;

const courseRequirementSchema = z.object({
    id: z.number().int(),
    type: z.enum(CourseRequirementType),
    courseId: z.number().int().nullable(),
    courseCode: z.string().nullable(),
    courseName: z.string().nullable(),
    prefixId: z.number().int().nullable(),
    prefix: z.string().nullable()
});

const electiveBlockSchema = z.object({
    credits: z.number().int(),
    courses: z.array(courseRequirementSchema)
});

const courseBlockSetSchema = z.object({
    mandatory: z.array(courseRequirementSchema),
    electives: z.array(electiveBlockSchema)
});

const catalogProgramEntity = z
    .object({
        id: z.number().int(),
        catalogId: z.number().int(),
        programId: z.number().int(),
        title: z.string(),
        catalogYear: z.number().int(),
        programCode: z.number().int(),
        programName: z.string(),
        base: courseBlockSetSchema,
        modalities: z.array(
            z.object({
                specializationId: z.number().int(),
                curriculumSuggestionId: z.number().int().nullable(),
                code: z.string(),
                name: z.string(),
                blocks: courseBlockSetSchema
            })
        ),
        languages: z.array(
            z.object({
                languageId: z.number().int(),
                name: z.string(),
                blocks: courseBlockSetSchema
            })
        ),
        _paths: z.object({
            self: z.string(),
            catalog: z.string(),
            program: z.string(),
            curriculumSuggestions: z.string()
        })
    })
    .strict()
    .openapi("CatalogProgramEntity");

const courseRequirementInputSchema = z.object({
    type: z.enum(CourseRequirementType),
    courseId: z.number().int().nullable().optional(),
    prefixId: z.number().int().nullable().optional()
});

const courseBlockInputSchema = z.object({
    type: z.enum(CourseBlockType),
    credits: z.number().int().nullable().optional(),
    requirements: z.array(courseRequirementInputSchema)
});

const courseBlockOperationsSchema = z
    .object({
        set: z.array(courseBlockInputSchema),
        add: z.array(courseBlockInputSchema),
        upsert: z.array(
            z.object({
                id: z.number().int(),
                type: z.enum(CourseBlockType),
                credits: z.number().int().nullable().optional(),
                requirements: z.array(courseRequirementInputSchema)
            })
        ),
        update: z.array(
            z.object({
                id: z.number().int(),
                type: z.enum(CourseBlockType).optional(),
                credits: z.number().int().nullable().optional(),
                requirements: z.array(courseRequirementInputSchema).optional()
            })
        ),
        remove: z.array(z.number().int())
    })
    .partial();

const catalogSpecializationOperationsSchema = z
    .object({
        set: z.array(
            z.object({
                specializationId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        add: z.array(
            z.object({
                specializationId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        upsert: z.array(
            z.object({
                specializationId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        update: z.array(
            z.object({
                specializationId: z.number().int(),
                courseBlocks: courseBlockOperationsSchema.optional()
            })
        ),
        remove: z.array(z.number().int())
    })
    .partial();

const catalogLanguageOperationsSchema = z
    .object({
        set: z.array(
            z.object({
                languageId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        add: z.array(
            z.object({
                languageId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        upsert: z.array(
            z.object({
                languageId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional()
            })
        ),
        update: z.array(
            z.object({
                languageId: z.number().int(),
                courseBlocks: courseBlockOperationsSchema.optional()
            })
        ),
        remove: z.array(z.number().int())
    })
    .partial();

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(catalogProgramEntity, "Catalog program retrieved successfully")
        .problem(
            404,
            CatalogProgramNotFoundProblemSchema,
            "Programa de catálogo não encontrado"
        )
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z
            .object({
                catalogId: z.string().pipe(z.coerce.number()).pipe(z.number()),
                programId: z.string().pipe(z.coerce.number()).pipe(z.number()),
                programCode: z.string().pipe(z.coerce.number()).pipe(z.number())
            })
            .partial()
    }),
    response: new OutputBuilder()
        .ok(
            z.array(catalogProgramEntity),
            "List of catalog programs retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: z
            .object({
                catalogId: z.number().int(),
                programId: z.number().int(),
                courseBlocks: z.array(courseBlockInputSchema).optional(),
                catalogSpecializations: z
                    .array(
                        z.object({
                            specializationId: z.number().int(),
                            courseBlocks: z
                                .array(courseBlockInputSchema)
                                .optional()
                        })
                    )
                    .optional(),
                catalogLanguages: z
                    .array(
                        z.object({
                            languageId: z.number().int(),
                            courseBlocks: z
                                .array(courseBlockInputSchema)
                                .optional()
                        })
                    )
                    .optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .created(catalogProgramEntity, "Catalog program created successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Recurso relacionado não encontrado"
        )
        .problem(
            409,
            CatalogProgramAlreadyExistsProblemSchema,
            "Programa já incluído no catálogo"
        )
        .problem(
            422,
            SpecializationNotInProgramProblemSchema,
            "Habilitação não disponível"
        )
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                courseBlocks: courseBlockOperationsSchema.optional(),
                catalogSpecializations:
                    catalogSpecializationOperationsSchema.optional(),
                catalogLanguages: catalogLanguageOperationsSchema.optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(catalogProgramEntity, "Catalog program updated successfully")
        .problem(
            404,
            CatalogProgramNotFoundProblemSchema,
            "Programa de catálogo não encontrado"
        )
        .problem(
            422,
            SpecializationNotInProgramProblemSchema,
            "Habilitação não disponível"
        )
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .noContent("Catalog program deleted successfully")
        .problem(
            404,
            CatalogProgramNotFoundProblemSchema,
            "Programa de catálogo não encontrado"
        )
        .build()
} satisfies IO;

export default {
    get,
    list,
    create,
    patch,
    remove,
    schemas: {
        catalogProgramEntity,
        courseRequirementSchema,
        electiveBlockSchema,
        courseBlockSetSchema
    }
};

export type CourseBlockInput = z.infer<typeof courseBlockInputSchema>;
export type CourseRequirementInput = z.infer<
    typeof courseRequirementInputSchema
>;
export type CourseBlockOperations = z.infer<typeof courseBlockOperationsSchema>;
export type CatalogSpecializationOperations = z.infer<
    typeof catalogSpecializationOperationsSchema
>;
export type CatalogLanguageOperations = z.infer<
    typeof catalogLanguageOperationsSchema
>;
