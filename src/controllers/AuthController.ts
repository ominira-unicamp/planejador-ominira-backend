import z from "zod";
import { requestSafeParse } from "../Validation";
import { Request, response, Response, Router } from "express";
import prisma from "../PrismaClient";
import * as jose from "jose";
import { AuthRegistry, generateToken } from "../auth";
import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import RequestBuilder from "../openapi/RequestBuilder";
import ResponseBuilder from "../openapi/ResponseBuilder";
extendZodWithOpenApi(z);
const router = Router()
const registry = new OpenAPIRegistry();
const authRegistry = new AuthRegistry();

const loginResponse = z.object({
	accessToken: z.string().describe("JWT access token to be used in Authorization header as Bearer token")
}).openapi("LoginResponse");
authRegistry.addException('POST', '/login');
registry.registerPath({
	method: 'post',
	path: '/login',
	tags: ['auth'],
	request: new RequestBuilder().build(),
	responses: new ResponseBuilder().build()
})
async function login(req: Request, res: Response) {
	const token = await generateToken({ userId: 1 })
	res.json({ accessToken: token });
}
router.post('/login', login);

export default {
	router,
	registry,
	authRegistry,
	paths: {
		login: () => '/login',
	},
	login
};