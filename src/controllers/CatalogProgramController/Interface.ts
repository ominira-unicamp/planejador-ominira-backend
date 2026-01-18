import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';
import catalogProgramEntity from './Entity.js';
import { CourseBlockType, CourseRequirementType } from '../../../prisma/generated/client.js';

extendZodWithOpenApi(z);

const courseRequirementInputSchema = z.object({
	type: z.enum(CourseRequirementType),
	courseId: z.number().int().nullable().optional(),
	prefixId: z.number().int().nullable().optional(),
});

const courseBlockInputSchema = z.object({
	type: z.enum(CourseBlockType),
	credits: z.number().int().nullable().optional(),
	requirements: z.array(courseRequirementInputSchema),
});

const courseBlockOperationsSchema = z.object({
	set: z.array(courseBlockInputSchema),
	add: z.array(courseBlockInputSchema),
	upsert: z.array(z.object({
		id: z.number().int(),
		type: z.enum(CourseBlockType),
		credits: z.number().int().nullable().optional(),
		requirements: z.array(courseRequirementInputSchema),
	})),
	update: z.array(z.object({
		id: z.number().int(),
		type: z.enum(CourseBlockType).optional(),
		credits: z.number().int().nullable().optional(),
		requirements: z.array(courseRequirementInputSchema).optional(),
	})),
	remove: z.array(z.number().int()),
}).partial();

const catalogSpecializationOperationsSchema = z.object({
	set: z.array(z.object({
		specializationId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	add: z.array(z.object({
		specializationId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	upsert: z.array(z.object({
		specializationId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	update: z.array(z.object({
		specializationId: z.number().int(),
		courseBlocks: courseBlockOperationsSchema.optional(),
	})),
	remove: z.array(z.number().int()),
}).partial();

const catalogLanguageOperationsSchema = z.object({
	set: z.array(z.object({
		languageId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	add: z.array(z.object({
		languageId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	upsert: z.array(z.object({
		languageId: z.number().int(),
		courseBlocks: z.array(courseBlockInputSchema).optional(),
	})),
	update: z.array(z.object({
		languageId: z.number().int(),
		courseBlocks: courseBlockOperationsSchema.optional(),
	})),
	remove: z.array(z.number().int()),
}).partial();

const get = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.ok(catalogProgramEntity.schema, "Catalog program retrieved successfully")
		.notFound()
		.build()
}

const list = {
	input: z.object({

	}),
	output: new OutputBuilder()
		.ok(z.array(catalogProgramEntity.schema), "List of catalog programs retrieved successfully")
		.build(),
}

const create = {
	input: z.object({
		body: z.object({
			catalogId: z.number().int(),
			programId: z.number().int(),
			courseBlocks: z.array(courseBlockInputSchema).optional(),
			catalogSpecializations: z.array(z.object({
				specializationId: z.number().int(),
				courseBlocks: z.array(courseBlockInputSchema).optional(),
			})).optional(),
			catalogLanguages: z.array(z.object({
				languageId: z.number().int(),
				courseBlocks: z.array(courseBlockInputSchema).optional(),
			})).optional(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.created(catalogProgramEntity.schema, "Catalog program created successfully")
		.badRequest()
		.build(),
}

const patch = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
		body: z.object({
			courseBlocks: courseBlockOperationsSchema.optional(),
			catalogSpecializations: catalogSpecializationOperationsSchema.optional(),
			catalogLanguages: catalogLanguageOperationsSchema.optional(),
		}).strict(),
	}),
	output: new OutputBuilder()
		.ok(catalogProgramEntity.schema, "Catalog program updated successfully")
		.notFound()
		.badRequest()
		.build(),
}

const remove = {
	input: z.object({
		path: z.object({
			id: z.string().pipe(z.coerce.number()).pipe(z.number()),
		}),
	}),
	output: new OutputBuilder()
		.noContent("Catalog program deleted successfully")
		.notFound()
		.build(),
}

export default {
	get,
	list,
	create,
	patch,
	remove,
}

export type CourseBlockInput = z.infer<typeof courseBlockInputSchema>;
export type CourseRequirementInput = z.infer<typeof courseRequirementInputSchema>;
export type CourseBlockOperations = z.infer<typeof courseBlockOperationsSchema>;
export type CatalogSpecializationOperations = z.infer<typeof catalogSpecializationOperationsSchema>;
export type CatalogLanguageOperations = z.infer<typeof catalogLanguageOperationsSchema>;
