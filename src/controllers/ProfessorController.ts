import { Router } from 'express'
import type { Request, Response } from "express";
import prisma, { MyPrisma } from '../PrismaClient'
import { AuthRegistry } from '../auth';
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { requestSafeParse, ValidationError, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';

extendZodWithOpenApi(z);

const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

type PrismaProfessorPayload = MyPrisma.ProfessorGetPayload<{}>;

function buildProfessorEntity(professor: PrismaProfessorPayload): z.infer<typeof professorEntity> {
	return {
		...professor,
		_paths: {
			entity: entityPath(professor.id),
		}
	};
}

const professorBase = z.object({
	id: z.number().int(),
	name: z.string().min(1),
});

const professorEntity = professorBase.extend({
    id: z.number().int(),
    name: z.string(),
    _paths: z.object({
        entity: z.string(),
    })
}).strict().openapi('ProfessorEntity');

const listProfessorsQuery = z.object({
    classId: z.coerce.number().int().optional(),
}).openapi('ListProfessorsQuery');

authRegistry.addException('GET', '/professors');
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
	const { success, query, error } = requestSafeParse({
		querySchema: listProfessorsQuery,
		query: req.query,
	});
	if (!success) {
		res.status(400).json(error);
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
        const entities : z.infer<typeof professorEntity>[] = professors.map((professor) => buildProfessorEntity(professor));
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

authRegistry.addException('GET', '/professors/:id');
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
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}
    prisma.professor.findUnique({
        where: {
            id: params.id,
        },
    }).then((professor) => {
        if (!professor) {
            res.status(404).json({ error: "Professor not found" });
            return;
        }
        const entity = buildProfessorEntity(professor);
		res.json(entity)
	})
}
router.get('/professors/:id', get)


const createProfessorBody = professorBase.omit({ id: true }).strict().openapi('CreateProfessorBody');

registry.registerPath({
	method: 'post',
	path: '/professors',
	tags: ['professor'],
	request: new RequestBuilder()
		.body(createProfessorBody, "Professor to create")
		.build(),
	responses: new ResponseBuilder()
		.created(professorEntity, "Professor created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});

async function create(req: Request, res: Response) {
	const { success, data: body, error } = createProfessorBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	
	if (errors.errors.length > 0 || !success) {
		res.status(400).json(errors);
		return;
	}

	const professor = await prisma.professor.create({
		data: body,
	});

	const entity = buildProfessorEntity(professor);
	res.status(201).json(professorEntity.parse(entity));
}
router.post('/professors', create)


const patchProfessorBody = professorBase.omit({ id: true }).partial().strict().openapi('PatchProfessorBody');

registry.registerPath({
	method: 'patch',
	path: '/professors/{id}',
	tags: ['professor'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchProfessorBody, "Professor fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(professorEntity, "Professor updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function patch(req: Request, res: Response) {
	const { success, params, body, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
		bodySchema: patchProfessorBody,
		body: req.body,
	});

	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.professor.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Professor not found' });
		return;
	}

	const professor = await prisma.professor.update({
		where: { id: params.id },
		data: {
			...(body.name !== undefined && { name: body.name }),
		},
	});

	const entity = buildProfessorEntity(professor);
	res.json(professorEntity.parse(entity));
}
router.patch('/professors/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/professors/{id}',
	tags: ['professor'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.build(),
	responses: new ResponseBuilder()
		.noContent()
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});

async function deleteProfessor(req: Request, res: Response) {
	const { success, params, error } = requestSafeParse({
		paramsSchema: z.object({ id: z.coerce.number().int() }).strict(),
		params: req.params,
	});
	if (!success) {
		res.status(400).json(error);
		return;
	}

	const existing = await prisma.professor.findUnique({ where: { id: params.id } });
	if (!existing) {
		res.status(404).json({ error: 'Professor not found' });
		return;
	}

	await prisma.professor.delete({ where: { id: params.id } });
	res.status(204).send();
}
router.delete('/professors/:id', deleteProfessor)

function entityPath(professorId: number) {
    return `/professors/${professorId}`;
}

export default {
	router,
    registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	},
}