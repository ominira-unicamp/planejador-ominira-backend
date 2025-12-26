import { Router } from 'express'
import type { Request, Response } from "express";
import prisma from '../PrismaClient'
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import ResponseBuilder from '../ResponseBuilder';
import { ZodErrorResponse } from '../Validation';

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();

const professorEntity = z.object({
    id: z.number().int(),
    name: z.string(),
    _paths: z.object({
        entity: z.string(),
    })
}).strict().openapi('ProfessorEntity');

const listProfessorsQuery = z.object({
    classId: z.coerce.number().int().optional(),
}).openapi('ListProfessorsQuery');

registry.registerPath({
    method: 'get',
    path: '/professors',
    tags: ['professor'],
    request: {
        query: listProfessorsQuery,
    },
    responses: new ResponseBuilder()
        .ok(z.array(professorEntity), "A list of professors")
        .badRequest()
        .internalServerError()
        .build(),
});

async function list(req: Request, res: Response) {
    const { success, data: query, error } = listProfessorsQuery.safeParse(req.query);
    if (!success) {
        res.status(400).json(ZodErrorResponse(["query"], error));
        return;
    }
    prisma.professor.findMany({
        where: {
            classes: {
                some: {
                    id: query.classId,
                }
            }
        },
    }).then((professors) => {
        const entities : z.infer<typeof professorEntity>[] = professors.map((professor) => ({
            ...professor,
            _paths: {
                entity: entityPath(professor.id),
            }
        }))
		res.json(entities)
	})
}
router.get('/professors', list)
interface ListQueryParams {
    classId?: number;
}
function listPath({
    classId
} : ListQueryParams) {
	return `/professors?` + [
		classId ? "classId=" + classId : undefined
	].filter(Boolean).join('&');
}

registry.registerPath({
    method: 'get',
    path: '/professors/{id}',
    tags: ['professor'],
    request: {
        params: z.object({
            id: z.int(),
        }),
    },
    responses: new ResponseBuilder()
        .ok(professorEntity, "A professor by id")
        .badRequest()
        .notFound()
        .internalServerError()
        .build(),
});

async function get(req: Request, res: Response) {
    const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
    if (!success) {
        res.status(400).json(ZodErrorResponse(["params", "id"], error));
        return;
    }
    prisma.professor.findUnique({
        where: {
            id: id,
        },
    }).then((professor) => {
        if (!professor) {
            res.status(404).json({ error: "Professor not found" });
            return;
        }
        const entity : z.infer<typeof professorEntity> = {
            ...professor,
            _paths: {
                entity: entityPath(professor.id),
            }
        }
		res.json(entity)
	})
}
router.get('/professors/:id', get)

function entityPath(professorId: number) {
    return `/professors/${professorId}`;
}

export default {
	router,
    registry,
    paths: {
        list: listPath,
        entity: entityPath,
    },
}