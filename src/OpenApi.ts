import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { apiReference } from '@scalar/express-api-reference'
import swaggerUi from 'swagger-ui-express'
import { Router } from "express";
import type { Request, Response } from "express";
import Controlellers from "./Controllers.js";

function convertExpressToOpenAPI(path: string): string {
  return path.replace(/\/:([\w-]+)/g, '/{$1}');
}

const router = Router()
const registry = Controlellers.registry;

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT', 
  description: 'JWT authorization using the Bearer scheme',
});

registry.definitions.forEach(r => {
	if (r.type == "route") {
		for (const exception of Controlellers.authRegistry.exceptions) {
			if (r.route.method.toUpperCase() == exception.method && r.route.path === convertExpressToOpenAPI(exception.path)) {
				return; 
			}
		}
		r.route.security = [{ BearerAuth: [] }];
		r.route.responses['401'] = {
			description: 'Unauthorized - Missing or invalid JWT token',
		};
	}
})

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

router.use('/api-docs', swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: '/openapi.json',
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
    },
    customSiteTitle: "My API Docs"
  })
);

export default {
	router
}