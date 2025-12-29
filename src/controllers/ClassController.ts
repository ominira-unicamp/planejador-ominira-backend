import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z, { ZodTuple } from 'zod';

import prisma, { MyPrisma, selectIdCode, selectIdName, whereIdCode, whereIdName } from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { ValidationError, ValidationErrorField, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { AuthRegistry } from '../auth';
import { zodIds } from '../PrismaValidator';
import { defaultGetHandler, defaultOpenApiGetPath } from '../defaultEndpoint';
import { Prisma } from '@prisma/client';
extendZodWithOpenApi(z);


const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

const prismaClassFieldSelection = {
	include: {
		professors: selectIdName,
		studyPeriod: selectIdCode,
		course: {
			select: {
				id: true,
				code: true,
				institute: selectIdCode,
			}

		},
	}
} as const satisfies MyPrisma.ClassDefaultArgs;
type PrismaClassPayload = MyPrisma.ClassGetPayload<typeof prismaClassFieldSelection>;

function buildClassEntity(classData: PrismaClassPayload): z.infer<typeof classEntity> {
	const { course, studyPeriod, ...rest } = classData;
	return {
		...rest,
		studyPeriodId: studyPeriod.id,
		studyPeriodCode: studyPeriod.code,
		courseId: course.id,
		courseCode: course.code,
		instituteId: course.institute.id,
		instituteCode: course.institute.code,
		professorIds: classData.professors.map((p) => p.id),
		_paths: relatedPathsForClass(classData),
	};
}
function relatedPathsForClass(classPayload: PrismaClassPayload) {
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(classPayload.studyPeriod.id),
		institute: resourcesPaths.institute.entity(classPayload.course.institute.id),
		course: resourcesPaths.course.entity(classPayload.course.id),
		class: resourcesPaths.class.entity(classPayload.id),
		classSchedules: resourcesPaths.classSchedule.list({
			classId: classPayload.id,
		}),
		professors: resourcesPaths.professor.list({
			classId: classPayload.id,
		}),
	}
}
const classBaseSchema = z.object({
	id: z.number().int(),
	code: z.string().min(1),
	reservations: z.array(z.number().int()),
	courseId: z.number().int(),
	studyPeriodId: z.number().int(),
	professorIds: z.array(z.number().int()),
});

const classEntity = classBaseSchema.extend({
	studyPeriodCode: z.string(),
	courseCode: z.string(),
	instituteId: z.number().int(),
	instituteCode: z.string(),
	professors: z.array(z.object({
		id: z.number().int(),
		name: z.string(),
	}).strict()),
	_paths: z.object({
		studyPeriod: z.string(),
		institute: z.string(),
		course: z.string(),
		class: z.string(),
		classSchedules: z.string(),
		professors: z.string(),
	}).strict(),
}).strict().openapi('ClassEntity');





const listClassesQuery = z.object({
	instituteId: z.coerce.number().int().optional(),
	instituteCode: z.string().optional(),
	courseId: z.coerce.number().int().optional(),
	courseCode: z.string().optional(),
	studyPeriodId: z.coerce.number().int().optional(),
	studyPeriodCode: z.string().optional(),
	professorId: z.coerce.number().int().optional(),
	professorName: z.string().optional(),
}).openapi('GetClassesQuery');

authRegistry.addException('GET', '/classes');
registry.registerPath({
	method: 'get',
	path: '/classes',
	tags: ['class'],
	request: {
		query: listClassesQuery,
	},
	responses: {
		...new ResponseBuilder()
			.ok(z.array(classEntity), "A list of classes")
			.badRequest()
			.internalServerError()
			.build()
	},
});

async function listAll(req: Request, res: Response) {
	const { success, data: query, error } = listClassesQuery.safeParse(req.query);
	if (!success) {
		res.status(400).json(ZodErrorResponse(error, ["query"]));
		return
	}
	const classes = await prisma.class.findMany({
		where: {
			course: {
				...whereIdCode(query.courseId, query.courseCode),
				institute: whereIdCode(query.instituteId, query.instituteCode),
			},
			studyPeriod: whereIdCode(query.studyPeriodId, query.studyPeriodCode),
			professors: {
				some: whereIdName(query.professorId, query.professorName)
			},
		},
		...prismaClassFieldSelection,
	});


	const entities: z.infer<typeof classEntity>[] = classes.map(c => buildClassEntity(c));
	res.json(z.array(classEntity).parse(entities));
}
router.get('/classes', listAll)




type ListQueryParams = {
	instituteId?: number | undefined,
	courseId?: number | undefined,
	studyPeriodId?: number | undefined,
	professorId?: number | undefined
}


function listPath({
	instituteId,
	courseId,
	studyPeriodId: studyPeriodId,
	professorId
}: ListQueryParams) {
	return `/classes?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		studyPeriodId ? "studyPeriodId=" + studyPeriodId : undefined,
		professorId ? "professorId=" + professorId : undefined,
	].filter(Boolean).join('&');
}

authRegistry.addException('GET', '/classes/:id');
registry.registerPath(defaultOpenApiGetPath('/classes/{id}', 'class', classEntity, "A class"));
router.get('/classes/:id', defaultGetHandler(
	prisma.class,
	prismaClassFieldSelection,
	buildClassEntity,
	"Class not found"
))

function entityPath(id: number) {
	return `/classes/${id}`;
}


const createClassBody = classBaseSchema.omit({ id: true }).strict().openapi('CreateClassBody');

registry.registerPath({
	method: 'post',
	path: '/classes',
	tags: ['class'],
	request: new RequestBuilder()
		.body(createClassBody, "Class to create")
		.build(),
	responses: new ResponseBuilder()
		.created(classEntity, "Class created successfully")
		.badRequest()
		.internalServerError()
		.build(),
});



async function create(req: Request, res: Response) {
	const { success, data: body, error } = await createClassBody.and(z.object({
		courseId: zodIds.course.exists,
		studyPeriodId: zodIds.studyPeriod.exists,
		professorIds: zodIds.professor.existsMany,
	})).safeParseAsync(req.body);

	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, ['body'])));
		return;
	}
	const classData = await prisma.class.create({
		data: {
			code: body.code,
			courseId: body.courseId,
			studyPeriodId: body.studyPeriodId,
			reservations: body.reservations,
			professors: {
				connect: body.professorIds.map(id => ({ id })),
			},
		},
		...prismaClassFieldSelection,
	});
	res.status(201).json(buildClassEntity(classData));
}
router.post('/classes', create)


const patchClassBody = classBaseSchema.partial().openapi('PatchClassBody');

registry.registerPath({
	method: 'patch',
	path: '/classes/{id}',
	tags: ['class'],
	request: new RequestBuilder()
		.params(z.object({ id: z.int() }).strict())
		.body(patchClassBody, "Class fields to update")
		.build(),
	responses: new ResponseBuilder()
		.ok(classEntity, "Class updated successfully")
		.badRequest()
		.notFound()
		.internalServerError()
		.build(),
});


async function patch(req: Request, res: Response) {

	const reqSchema = z.object({
		params: z.object({
			id: z.coerce.number().int(),
		}).strict(),
		body: patchClassBody.and(z.object({
			courseId: zodIds.course.exists,
			studyPeriodId: zodIds.studyPeriod.exists,
			professorIds: zodIds.professor.existsMany,
		})),
	});
	const {success, data, error} = await reqSchema.safeParseAsync(req);
	if (!success) {
		res.status(400).json(new ValidationError(ZodErrorResponse(error, [])));
		return;
	}
	const { params: { id }, body } = data;
	const existing = await prisma.class.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: 'Class not found' });
		return;
	}

	const classData = await prisma.class.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.courseId !== undefined && { courseId: body.courseId }),
			...(body.studyPeriodId !== undefined && { studyPeriodId: body.studyPeriodId }),
			...(body.reservations !== undefined && { reservations: body.reservations }),
			...(body.professorIds !== undefined && {
				professors: {
					set: body.professorIds.map(id => ({ id })),
				},
			}),
		},
		...prismaClassFieldSelection,
	});

	res.json(buildClassEntity(classData));
}
router.patch('/classes/:id', patch)


registry.registerPath({
	method: 'delete',
	path: '/classes/{id}',
	tags: ['class'],
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

async function deleteClass(req: Request, res: Response) {
	const { success, data: id, error } = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(error, ['params', 'id']));
		return;
	}

	const existing = await prisma.class.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: 'Class not found' });
		return;
	}

	await prisma.class.delete({ where: { id } });
	res.status(204).send();
}

router.delete('/classes/:id', deleteClass)

export default {
	router,
	registry,
	authRegistry,
	paths: {
		list: listPath,
		entity: entityPath,
	}
} 