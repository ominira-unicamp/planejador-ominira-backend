import { policies } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    pathSeg,
    ReferenceNotFoundProblemSchema,
    UniqueConstraintConflictProblemSchema
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const id = z.coerce.number().int().positive();
const entityId = z.object({ id }).strict();
const category = z
    .object({ id: z.number().int(), name: z.string().min(1) })
    .strict()
    .openapi("Category");
const tag = z
    .object({
        id: z.number().int(),
        name: z.string().min(1),
        categoryId: z.number().int(),
        parentTagId: z.number().int().nullable()
    })
    .strict()
    .openapi("Tag");
export const relatedCourse = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        credits: z.number().int().min(0)
    })
    .strict()
    .openapi("TagRelatedCourse");
const categoryBody = z.object({ name: z.string().trim().min(1) }).strict();
const tagBody = z
    .object({
        name: z.string().trim().min(1),
        categoryId: id,
        parentTagId: id.nullable()
    })
    .strict();
const courseTagPath = z.object({ courseId: id, tagId: id }).strict();
const coursePath = z.object({ courseId: id }).strict();

const categories = [pathSeg.literal("categories")];
const tags = [pathSeg.literal("tags")];

const listCategories = {
    meta: {
        method: "get" as const,
        path: categories,
        tags: ["categories"],
        authorization: policies.public
    },
    request: z.object({ query: z.object({}).strict() }),
    response: new OutputBuilder()
        .ok(z.array(category), "Categorias recuperadas")
        .build()
} satisfies IO;
const getCategory = {
    meta: {
        method: "get" as const,
        path: [...categories, pathSeg.param("id")],
        tags: ["categories"],
        authorization: policies.public
    },
    request: z.object({ path: entityId }),
    response: new OutputBuilder()
        .ok(category, "Categoria recuperada")
        .notFound()
        .build()
} satisfies IO;
const listTags = {
    meta: {
        method: "get" as const,
        path: tags,
        tags: ["tags"],
        authorization: policies.public
    },
    request: z.object({
        query: z
            .object({
                categoryId: id.optional(),
                parentTagId: id.optional(),
                courseId: id.optional()
            })
            .strict()
    }),
    response: new OutputBuilder().ok(z.array(tag), "Tags recuperadas").build()
} satisfies IO;
const getTag = {
    meta: {
        method: "get" as const,
        path: [...tags, pathSeg.param("id")],
        tags: ["tags"],
        authorization: policies.public
    },
    request: z.object({ path: entityId }),
    response: new OutputBuilder().ok(tag, "Tag recuperada").notFound().build()
} satisfies IO;
const listCourseTags = {
    meta: {
        method: "get" as const,
        path: [
            pathSeg.literal("courses"),
            pathSeg.param("courseId"),
            pathSeg.literal("tags")
        ],
        tags: ["course-tags"],
        authorization: policies.public
    },
    request: z.object({ path: coursePath }),
    response: new OutputBuilder()
        .ok(z.array(tag), "Tags da disciplina recuperadas")
        .notFound()
        .build()
} satisfies IO;
const listTagCourses = {
    meta: {
        method: "get" as const,
        path: [...tags, pathSeg.param("id"), pathSeg.literal("courses")],
        tags: ["course-tags"],
        authorization: policies.public
    },
    request: z.object({
        path: entityId,
        query: z
            .object({
                page: z.coerce.number().int().min(1).optional(),
                pageSize: z.coerce.number().int().min(1).optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(relatedCourse),
            "Disciplinas correlatas recuperadas"
        )
        .notFound()
        .build()
} satisfies IO;

const createCategory = {
    meta: {
        method: "post" as const,
        path: categories,
        tags: ["categories"],
        authorization: policies.authenticated
    },
    request: z.object({ body: categoryBody }),
    response: new OutputBuilder()
        .created(category, "Categoria criada")
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Categoria já existe"
        )
        .build()
} satisfies IO;
const updateCategory = {
    meta: {
        method: "put" as const,
        path: [...categories, pathSeg.param("id")],
        tags: ["categories"],
        authorization: policies.authenticated
    },
    request: z.object({ path: entityId, body: categoryBody }),
    response: new OutputBuilder()
        .ok(category, "Categoria atualizada")
        .notFound()
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Categoria já existe"
        )
        .build()
} satisfies IO;
const deleteCategory = {
    meta: {
        method: "delete" as const,
        path: [...categories, pathSeg.param("id")],
        tags: ["categories"],
        authorization: policies.authenticated
    },
    request: z.object({ path: entityId }),
    response: new OutputBuilder()
        .noContent("Categoria removida")
        .notFound()
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Categoria possui dependências"
        )
        .build()
} satisfies IO;
const createTag = {
    meta: {
        method: "post" as const,
        path: tags,
        tags: ["tags"],
        authorization: policies.authenticated
    },
    request: z.object({ body: tagBody }),
    response: new OutputBuilder()
        .created(tag, "Tag criada")
        .problem(409, UniqueConstraintConflictProblemSchema, "Tag já existe")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Categoria ou tag pai não encontrada"
        )
        .build()
} satisfies IO;
const updateTag = {
    meta: {
        method: "put" as const,
        path: [...tags, pathSeg.param("id")],
        tags: ["tags"],
        authorization: policies.authenticated
    },
    request: z.object({ path: entityId, body: tagBody }),
    response: new OutputBuilder()
        .ok(tag, "Tag atualizada")
        .notFound()
        .problem(409, UniqueConstraintConflictProblemSchema, "Tag já existe")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Categoria ou tag pai não encontrada"
        )
        .build()
} satisfies IO;
const deleteTag = {
    meta: {
        method: "delete" as const,
        path: [...tags, pathSeg.param("id")],
        tags: ["tags"],
        authorization: policies.authenticated
    },
    request: z.object({ path: entityId }),
    response: new OutputBuilder()
        .noContent("Tag removida")
        .notFound()
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Tag possui dependências"
        )
        .build()
} satisfies IO;
const putCourseTag = {
    meta: {
        method: "put" as const,
        path: [
            pathSeg.literal("courses"),
            pathSeg.param("courseId"),
            pathSeg.literal("tags"),
            pathSeg.param("tagId")
        ],
        tags: ["course-tags"],
        authorization: policies.authenticated
    },
    request: z.object({ path: courseTagPath }),
    response: new OutputBuilder()
        .noContent("Tag associada à disciplina")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Disciplina ou tag não encontrada"
        )
        .build()
} satisfies IO;
const deleteCourseTag = {
    meta: {
        method: "delete" as const,
        path: [
            pathSeg.literal("courses"),
            pathSeg.param("courseId"),
            pathSeg.literal("tags"),
            pathSeg.param("tagId")
        ],
        tags: ["course-tags"],
        authorization: policies.authenticated
    },
    request: z.object({ path: courseTagPath }),
    response: new OutputBuilder()
        .noContent("Tag removida da disciplina")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Disciplina ou tag não encontrada"
        )
        .build()
} satisfies IO;

export type CategoryEntity = z.infer<typeof category>;
export type TagEntity = z.infer<typeof tag>;
export default {
    listCategories,
    getCategory,
    listTags,
    getTag,
    listCourseTags,
    listTagCourses,
    createCategory,
    updateCategory,
    deleteCategory,
    createTag,
    updateTag,
    deleteTag,
    putCourseTag,
    deleteCourseTag
};
