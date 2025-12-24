import { Router } from 'express'
import type { Request, Response } from "express";
import prisma from '../PrismaClient'
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();


registry.registerPath({
    method: 'get',
    path: '/teachers',
    tags: ['teacher'],
    responses: {
        200: {
            description: "A list of teachers",
            content: {
                'application/json': {
                    schema: z.array(z.any()), 
                },
            },
        },
    },
});
async function get(req: Request, res: Response) {
	prisma.teacher.findMany().then((teachers) => {
		res.json(teachers)
	})
}
router.get('/teachers', get)

export default {
	router,
    registry,
}
