import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { OutputBuilder } from '../../BuildHandler.js';

extendZodWithOpenApi(z);

const loginResponse = z.object({
	accessToken: z.string().describe("JWT access token to be used in Authorization header as Bearer token")
}).openapi("LoginResponse");

const login = {
	input: z.object({}),
	output: new OutputBuilder()
		.ok(loginResponse, "Successful login response")
		.build()
}

export default {
	login
}
