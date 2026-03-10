import z from "zod";

export function getPaginatedSchema<T extends z.ZodType>(dataSchema: T) {
    return z.object({
        data: z.array(dataSchema),
        quantity: z.number().int(),
        total: z.number().int(),
        _paths: z.object({
            firstPage: z.string(),
            lastPage: z.string(),
            next: z.string().nullable(),
            prev: z.string().nullable()
        })
    });
}

export type PaginatedSchemaType<T extends z.ZodType> = ReturnType<
    typeof getPaginatedSchema<T>
>;
export type PaginatedResult<T extends z.ZodType> = z.infer<
    ReturnType<typeof getPaginatedSchema<T>>
>;
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1).openapi({
        description: "The page number to retrieve (default: 1)"
    }),
    pageSize: z.coerce.number().int().min(1).optional().default(20).openapi({
        description: "The number of items per page (default: 20)"
    })
});
export type PaginationQueryType = z.infer<typeof paginationQuerySchema>;
export function prismaPaginationParamsFromQuery(query: PaginationQueryType) {
    const page = query.page;
    const pageSize = query.pageSize;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    return { skip, take };
}

export function buildPaginationResponse<T extends z.ZodType>(
    items: z.infer<T>[],
    totalItems: number,
    query: PaginationQueryType,
    buildPath: (pageNum: number) => string
): PaginatedResult<T> {
    const page = query.page;
    const pageSize = query.pageSize;
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
        data: items,
        quantity: items.length,
        total: totalItems,
        _paths: {
            firstPage: buildPath(1),
            lastPage: buildPath(totalPages),
            next: page < totalPages ? buildPath(page + 1) : null,
            prev: page > 1 ? buildPath(page - 1) : null
        }
    };
}
