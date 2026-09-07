import type {
    CategoryEntity,
    TagEntity
} from "#/modules/tagging/Tagging.contract.js";
import {
    err,
    ok,
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    type Result
} from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";

type ConflictProblem = ReturnType<
    typeof UniqueConstraintConflictProblem.create
>;
type ResourceNotFound = ReturnType<typeof ResourceNotFoundProblem.create>;
type ReferenceNotFound = ReturnType<typeof ReferenceNotFoundProblem.create>;
type RelatedCourse = {
    id: number;
    code: string;
    name: string;
    credits: number;
};
const category = (value: { id: number; name: string }): CategoryEntity => value;
const tag = (value: {
    id: number;
    name: string;
    categoryId: number;
    parentTagId: number | null;
}): TagEntity => value;
const resourceNotFound = (detail: string) =>
    ResourceNotFoundProblem.create({ detail });
const referenceNotFound = (detail: string) =>
    ReferenceNotFoundProblem.create({ detail, fields: [] });
const conflict = (detail: string) =>
    UniqueConstraintConflictProblem.create({ detail, fields: [] });

export type TaggingService = {
    listCategories(): Promise<CategoryEntity[]>;
    getCategory(
        id: number
    ): Promise<Result<CategoryEntity, ReturnType<typeof resourceNotFound>>>;
    listTags(query: {
        categoryId?: number;
        parentTagId?: number;
        courseId?: number;
    }): Promise<TagEntity[]>;
    getTag(
        id: number
    ): Promise<Result<TagEntity, ReturnType<typeof resourceNotFound>>>;
    listCourseTags(
        courseId: number
    ): Promise<Result<TagEntity[], ReturnType<typeof resourceNotFound>>>;
    listTagCourses(
        tagId: number,
        page: number,
        pageSize: number
    ): Promise<
        Result<
            { items: RelatedCourse[]; total: number },
            ReturnType<typeof resourceNotFound>
        >
    >;
    createCategory(input: {
        name: string;
    }): Promise<Result<CategoryEntity, ConflictProblem>>;
    updateCategory(
        id: number,
        input: { name: string }
    ): Promise<Result<CategoryEntity, ResourceNotFound | ConflictProblem>>;
    deleteCategory(
        id: number
    ): Promise<Result<null, ResourceNotFound | ConflictProblem>>;
    createTag(input: {
        name: string;
        categoryId: number;
        parentTagId?: number | null;
    }): Promise<Result<TagEntity, ReferenceNotFound | ConflictProblem>>;
    updateTag(
        id: number,
        input: { name: string; categoryId: number; parentTagId?: number | null }
    ): Promise<
        Result<
            TagEntity,
            ResourceNotFound | ReferenceNotFound | ConflictProblem
        >
    >;
    deleteTag(
        id: number
    ): Promise<Result<null, ResourceNotFound | ConflictProblem>>;
    putCourseTag(
        courseId: number,
        tagId: number
    ): Promise<Result<null, ReferenceNotFound>>;
    deleteCourseTag(
        courseId: number,
        tagId: number
    ): Promise<Result<null, ReferenceNotFound>>;
};

export function createTaggingService({
    prisma
}: {
    prisma: PrismaClient;
}): TaggingService {
    async function validateParent(
        tagId: number | undefined,
        categoryId: number,
        parentTagId: number | null | undefined
    ): Promise<ConflictProblem | ReferenceNotFound | undefined> {
        if (parentTagId === undefined || parentTagId === null) return undefined;
        if (parentTagId === tagId)
            return conflict("A tag não pode ser pai de si mesma.");
        const parent = await prisma.tag.findUnique({
            where: { id: parentTagId }
        });
        if (!parent) return referenceNotFound("Tag pai não encontrada.");
        if (parent.categoryId !== categoryId)
            return conflict("A tag pai deve pertencer à mesma categoria.");
        let current = parent;
        while (current.parentTagId !== null) {
            if (current.parentTagId === tagId)
                return conflict("A hierarquia de tags não pode formar ciclos.");
            const next = await prisma.tag.findUnique({
                where: { id: current.parentTagId }
            });
            if (!next) break;
            current = next;
        }
        return undefined;
    }
    async function validateTagInput(
        tagId: number | undefined,
        input: { categoryId: number; parentTagId?: number | null }
    ): Promise<ConflictProblem | ReferenceNotFound | undefined> {
        const categoryExists = await prisma.category.findUnique({
            where: { id: input.categoryId },
            select: { id: true }
        });
        if (!categoryExists)
            return referenceNotFound("Categoria não encontrada.");
        return validateParent(tagId, input.categoryId, input.parentTagId);
    }
    return {
        async listCategories() {
            return await prisma.category.findMany({ orderBy: { name: "asc" } });
        },
        async getCategory(id) {
            const value = await prisma.category.findUnique({ where: { id } });
            return value
                ? ok(category(value))
                : err(resourceNotFound("Category not found"));
        },
        async listTags(query) {
            return await prisma.tag.findMany({
                where: {
                    ...(query.categoryId
                        ? { categoryId: query.categoryId }
                        : {}),
                    ...(query.parentTagId
                        ? { parentTagId: query.parentTagId }
                        : {}),
                    ...(query.courseId
                        ? { courseTags: { some: { courseId: query.courseId } } }
                        : {})
                },
                orderBy: { name: "asc" }
            });
        },
        async getTag(id) {
            const value = await prisma.tag.findUnique({ where: { id } });
            return value
                ? ok(tag(value))
                : err(resourceNotFound("Tag not found"));
        },
        async listCourseTags(courseId) {
            const courseExists = await prisma.course.findUnique({
                where: { id: courseId },
                select: { id: true }
            });
            if (!courseExists) return err(resourceNotFound("Course not found"));
            return ok(
                await prisma.tag.findMany({
                    where: { courseTags: { some: { courseId } } },
                    orderBy: { name: "asc" }
                })
            );
        },
        async listTagCourses(tagId, page, pageSize) {
            const tagExists = await prisma.tag.findUnique({
                where: { id: tagId },
                select: { id: true }
            });
            if (!tagExists) return err(resourceNotFound("Tag not found"));
            const where = { courseTags: { some: { tagId } } };
            const [total, items] = await Promise.all([
                prisma.course.count({ where }),
                prisma.course.findMany({
                    where,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: { id: true, code: true, name: true, credits: true }
                })
            ]);
            return ok({ total, items });
        },
        async createCategory(input) {
            if (
                await prisma.category.findUnique({
                    where: { name: input.name }
                })
            )
                return err(conflict("Já existe uma categoria com este nome."));
            return ok(category(await prisma.category.create({ data: input })));
        },
        async updateCategory(id, input) {
            if (
                !(await prisma.category.findUnique({
                    where: { id },
                    select: { id: true }
                }))
            )
                return err(resourceNotFound("Category not found"));
            const sameName = await prisma.category.findFirst({
                where: { name: input.name, NOT: { id } }
            });
            if (sameName)
                return err(conflict("Já existe uma categoria com este nome."));
            return ok(
                category(
                    await prisma.category.update({ where: { id }, data: input })
                )
            );
        },
        async deleteCategory(id) {
            const value = await prisma.category.findUnique({
                where: { id },
                select: { _count: { select: { tags: true } } }
            });
            if (!value) return err(resourceNotFound("Category not found"));
            if (value._count.tags > 0)
                return err(
                    conflict(
                        "Não é possível remover uma categoria que possui tags."
                    )
                );
            await prisma.category.delete({ where: { id } });
            return ok(null);
        },
        async createTag(input) {
            const validation = await validateTagInput(undefined, input);
            if (validation) return err(validation);
            if (
                await prisma.tag.findUnique({
                    where: {
                        categoryId_name: {
                            categoryId: input.categoryId,
                            name: input.name
                        }
                    }
                })
            )
                return err(
                    conflict("Já existe uma tag com este nome nesta categoria.")
                );
            return ok(
                tag(
                    await prisma.tag.create({
                        data: {
                            ...input,
                            parentTagId: input.parentTagId ?? null
                        }
                    })
                )
            );
        },
        async updateTag(id, input) {
            const existing = await prisma.tag.findUnique({
                where: { id },
                include: { children: { select: { id: true } } }
            });
            if (!existing) return err(resourceNotFound("Tag not found"));
            if (
                existing.categoryId !== input.categoryId &&
                existing.children.length > 0
            )
                return err(
                    conflict(
                        "Não é possível mudar a categoria de uma tag que possui filhas."
                    )
                );
            const validation = await validateTagInput(id, input);
            if (validation) return err(validation);
            const sameName = await prisma.tag.findFirst({
                where: {
                    categoryId: input.categoryId,
                    name: input.name,
                    NOT: { id }
                }
            });
            if (sameName)
                return err(
                    conflict("Já existe uma tag com este nome nesta categoria.")
                );
            return ok(
                tag(
                    await prisma.tag.update({
                        where: { id },
                        data: {
                            ...input,
                            parentTagId: input.parentTagId ?? null
                        }
                    })
                )
            );
        },
        async deleteTag(id) {
            const value = await prisma.tag.findUnique({
                where: { id },
                select: {
                    _count: { select: { children: true, courseTags: true } }
                }
            });
            if (!value) return err(resourceNotFound("Tag not found"));
            if (value._count.children > 0 || value._count.courseTags > 0)
                return err(
                    conflict(
                        "Não é possível remover uma tag que possui filhas ou associações com disciplinas."
                    )
                );
            await prisma.tag.delete({ where: { id } });
            return ok(null);
        },
        async putCourseTag(courseId, tagId) {
            const [course, tagValue] = await Promise.all([
                prisma.course.findUnique({
                    where: { id: courseId },
                    select: { id: true }
                }),
                prisma.tag.findUnique({
                    where: { id: tagId },
                    select: { id: true }
                })
            ]);
            if (!course)
                return err(referenceNotFound("Disciplina não encontrada."));
            if (!tagValue) return err(referenceNotFound("Tag não encontrada."));
            await prisma.courseTag.upsert({
                where: { courseId_tagId: { courseId, tagId } },
                create: { courseId, tagId },
                update: {}
            });
            return ok(null);
        },
        async deleteCourseTag(courseId, tagId) {
            const [course, tagValue] = await Promise.all([
                prisma.course.findUnique({
                    where: { id: courseId },
                    select: { id: true }
                }),
                prisma.tag.findUnique({
                    where: { id: tagId },
                    select: { id: true }
                })
            ]);
            if (!course)
                return err(referenceNotFound("Disciplina não encontrada."));
            if (!tagValue) return err(referenceNotFound("Tag não encontrada."));
            await prisma.courseTag.deleteMany({ where: { courseId, tagId } });
            return ok(null);
        }
    };
}
