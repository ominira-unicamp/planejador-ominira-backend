import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { apiReference } from '@scalar/express-api-reference'
import { Router } from "express";
import type { Request, Response } from "express";
import Controlellers from "./Controlellers";



const router = Router()
const registry = Controlellers.registry;
const generator = new OpenApiGeneratorV3(registry.definitions);

router.get('/openapi.json', (req : Request, res : Response) => {
	res.json(generator.generateDocument({
		openapi: '3.0.0',
		info: {
			version: '1.0.0',
			title: 'Pomi',
			description: 'This is the API',
		},
		servers: [{ url: '', description: 'POMI' }],
	}
	));
});

router.use(
	'/docs',
	apiReference({
		url: '/openapi.json',
	})
);

export default {
	router
}