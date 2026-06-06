import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("catalog-programs")];
const tags = ["catalog-programs"];
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
            program: z.string()
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
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(catalogProgramEntity, "Catalog program retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z
            .object({
                catalogId: z.string().pipe(z.coerce.number()).pipe(z.number()),
                programId: z.string().pipe(z.coerce.number()).pipe(z.number()),
                programCode: z.string().pipe(z.coerce.number()).pipe(z.number())
            })
            .partial()
    }),
    output: new OutputBuilder()
        .ok(
            z.array(catalogProgramEntity),
            "List of catalog programs retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
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
    output: new OutputBuilder()
        .created(catalogProgramEntity, "Catalog program created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
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
    output: new OutputBuilder()
        .ok(catalogProgramEntity, "Catalog program updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Catalog program deleted successfully")
        .notFound()
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
