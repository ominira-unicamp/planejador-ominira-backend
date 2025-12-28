import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z, { ZodTuple } from 'zod';

import prisma, { MyPrisma, selectIdCode, selectIdName, whereIdCode, whereIdName } from '../PrismaClient'
import { resourcesPaths } from '../Controllers';
import ResponseBuilder from '../openapi/ResponseBuilder';
import { requestSafeParse, ValidationError, ZodErrorResponse } from '../Validation';
import RequestBuilder from '../openapi/RequestBuilder';
import { AuthRegistry } from '../auth';
extendZodWithOpenApi(z);


const router = Router()
const authRegistry = new AuthRegistry();
const registry = new OpenAPIRegistry();

const prismaClassFieldSelection = {
	include: {
		professors: selectIdName,
		coursesOffering: {
			select: {
				studyPeriod: selectIdCode,
				course: selectIdCode,
				institute: selectIdCode,
			}  
		}  
	}  
} as const satisfies MyPrisma.ClassDefaultArgs;
type PrismaClassPayload = MyPrisma.ClassGetPayload<typeof prismaClassFieldSelection>;

function buildClassEntity(classData: PrismaClassPayload): z.infer<typeof classEntity> {
	const { coursesOffering, ...rest } = classData;
	return {
		...rest,
		studyPeriodId: coursesOffering.studyPeriod.id,
		studyPeriodCode: coursesOffering.studyPeriod.code,
		courseId: coursesOffering.course.id,
		courseCode: coursesOffering.course.code,
		instituteId: coursesOffering.institute.id,
		instituteCode: coursesOffering.institute.code,
		professorIds: classData.professors.map((p) => p.id),
		_paths: relatedPathsForClass(classData),
	};
}
function relatedPathsForClass(classPayload: PrismaClassPayload) {
	const coursesOffering = classPayload.coursesOffering;
	return {
		studyPeriod: resourcesPaths.studyPeriod.entity(coursesOffering.studyPeriod.id),
		institute: resourcesPaths.institute.entity(coursesOffering.institute.id),
		course: resourcesPaths.course.entity(coursesOffering.course.id),
		courseOffering: resourcesPaths.courseOffering.entity(classPayload.courseOfferingId),
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
	courseOfferingId: z.number().int(),
	reservations: z.array(z.number().int()),
	professorIds: z.array(z.number().int()),
});

const classEntity = classBaseSchema.extend({
	studyPeriodId: z.number().int(),
	studyPeriodCode: z.string(),
	courseId: z.number().int(),
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
		courseOffering: z.string(),
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
	periodId: z.coerce.number().int().optional(),
	periodName: z.string().optional(),
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
		res.status(400).json(ZodErrorResponse(["query"], error));
		return
	}
	const classes = await prisma.class.findMany({
		where: {
			coursesOffering: {
				instituteId: query.instituteId,
				institute: whereIdCode(query.instituteId, query.instituteCode),
				course: whereIdCode(query.courseId, query.courseCode),
				studyPeriod: whereIdCode(query.periodId, query.periodName)
			},
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
	periodId?: number | undefined,
	professorId?: number | undefined
}


function listPath({
	instituteId,
	courseId,
	periodId,
	professorId
}: ListQueryParams) {
	return `/classes?` + [
		instituteId ? "instituteId=" + instituteId : undefined,
		courseId ? "courseId=" + courseId : undefined,
		periodId ? "periodId=" + periodId : undefined,
		professorId ? "professorId=" + professorId : undefined,
	].filter(Boolean).join('&');
}

authRegistry.addException('GET', '/classes/:id');
registry.registerPath({
	method: 'get',
	path: '/classes/{id}',
	tags: ['class'],
	request: {
		params: z.object({
			id: z.int(),
		}),
	},
	responses: new ResponseBuilder()
		.ok(classEntity, "A class")
		.notFound()
		.badRequest()
		.internalServerError()
		.build(),
});
async function get(req: Request, res: Response) {
	const {data: id, success, error} = z.coerce.number().int().safeParse(req.params.id);
	if (!success) {
		res.status(400).json(ZodErrorResponse(["params","id"], error));
		return;
	}
	prisma.class.findUnique({
		where: {
			id: id,
		},
		...prismaClassFieldSelection
	}).then((classData) => {
		if (!classData) {
			res.status(404).json({ error: "Class not found" });
			return;
		}
		res.json(classEntity.parse(buildClassEntity(classData)))
	})
}
router.get('/classes/:id', get)

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
	const { success, data: body, error } = createClassBody.safeParse(req.body);
	const errors = new ValidationError('Validation errors', []);
	if (!success) {
		errors.addErrors(ZodErrorResponse(['body'], error));
	}
	if (body) {
		const courseOffering = await prisma.courseOffering.findUnique({
			where: { id: body.courseOfferingId }
		});

		if (!courseOffering) {
			errors.addError(['body', 'courseOfferingId'], 'Course offering not found');
		}
	
		if (body.professorIds.length > 0) {
			const professors = await prisma.professor.findMany({
				where: { id: { in: body.professorIds } }
			});
			if (professors.length !== body.professorIds.length) {
				errors.addError(['body', 'professorIds'], 'One or more professors not found');
			}
		}
	}	
	if (!success) {
		res.status(400).json(errors);
		return;
	}
	const classData = await prisma.class.create({
		data: {
			code: body.code,
			courseOfferingId: body.courseOfferingId,
			reservations: body.reservations,
			professors: {
				connect: body.professorIds.map(id => ({ id })),
			},
		},
		...prismaClassFieldSelection,
	});
	res.status(201).json(classEntity.parse(buildClassEntity(classData)));
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

	const {
		success,
		query,
		params,
		body,
		error
	} = requestSafeParse({
		paramsSchema: z.object({
			id: z.coerce.number().int(),
		}).strict(),
		params: req.params,
		bodySchema: patchClassBody,
		body: req.body,
	})
	const validation = new ValidationError('Validation errors', error);

	if (success && body?.courseOfferingId !== undefined) {
		const courseOffering = await prisma.courseOffering.findUnique({where: { id: body.courseOfferingId }});
		if (!courseOffering) 
			validation.addError(['body', 'courseOfferingId'], 'Course offering not found');
		
	}

	if (success && body?.professorIds && body.professorIds.length > 0) {
		const professors = await prisma.professor.findMany({where: { id: { in: body.professorIds } }});
		if (professors.length !== body.professorIds.length) {
			validation.addError(['body', 'professorIds'], 'One or more professors not found');
		}
	}

	if (!success) {
		res.status(400).json(validation);
		return;
	}
	const id = params.id;

	const existing = await prisma.class.findUnique({ where: { id } });
	if (!existing) {
		res.status(404).json({ error: 'Class not found' });
		return;
	}

	const classData = await prisma.class.update({
		where: { id },
		data: {
			...(body.code !== undefined && { code: body.code }),
			...(body.courseOfferingId !== undefined && { courseOfferingId: body.courseOfferingId }),
			...(body.reservations !== undefined && { reservations: body.reservations }),
			...(body.professorIds !== undefined && {
				professors: {
					set: body.professorIds.map(id => ({ id })),
				},
			}),
		},
		...prismaClassFieldSelection,
	});

	res.json(classEntity.parse(buildClassEntity(classData)));
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
		res.status(400).json(ZodErrorResponse(['params', 'id'], error));
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