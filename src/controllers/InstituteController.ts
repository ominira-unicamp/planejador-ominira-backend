import { Router } from 'express'
import type { Request, Response } from "express";
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import z from 'zod';

import prisma from '../PrismaClient'

extendZodWithOpenApi(z);

const router = Router()
const registry = new OpenAPIRegistry();


registry.registerPath({
	method: 'get',
	path: '/institutes',
	tags: ['institute'],
	responses: {
		200: {
			description: "A list of institutes",
			content: {
				'application/json': {
					schema: z.array(z.any()), 
				},
			},
		},
	},
});
async function get(req: Request, res: Response) {
	prisma.institute.findMany().then((institutes) => {
		res.json(institutes)
	})
}
router.get('/institutes', get)

export default {
	router,
	registry,
}
