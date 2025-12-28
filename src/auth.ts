import { Request, Response, NextFunction } from "express";
import * as jose from "jose";
import { match, pathToRegexp, compile, parse, stringify } from "path-to-regexp";
if (!process.env.secretKey) {
	console.warn("Warning: secretKey environment variable is not set. Using default value.");
} 
const secretKey = process.env.secretKey ?? "default";
const secret = new TextEncoder().encode(secretKey)
const alg = 'HS256'

async function generateToken(payload: object, expiresIn: string = '2h'): Promise<string> {
	const jwt = await new jose.SignJWT({ 'urn:example:claim': true })
		.setProtectedHeader({ alg })
		.setExpirationTime(expiresIn)
		.sign(secret)
	console.log(jwt)
	return jwt;

}

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ExceptionType = {
	method: Methods,
	path: string
}
class AuthRegistry {
	exceptions : ExceptionType[] = [];
	constructor(authRegistries: AuthRegistry[] = []) {
		for (const registry of authRegistries) {
			this.exceptions.push(...registry.exceptions);
		}
	}

	addException(method: Methods, path: string) {
		this.exceptions.push({ method, path });
	}
	checkException(method: Methods, path: string): boolean {
		for (const exception of this.exceptions) {
			if (exception.method === method) {
				const fn = match(exception.path, { decode: decodeURIComponent });
				const result = fn(path);
				if (result) return true;
			}
		}
		return false;
	}
	middleware() {
		return async (req: Request, res: Response, next: NextFunction) => {
			const authHeader = req.headers.authorization;
			if (this.checkException(req.method as Methods, req.path)) {
				return next();
			}
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return res.status(401).json({ error: 'Unauthorized' });
			}
			try {
				const { payload } = await jose.jwtVerify(authHeader.substring(7), secret);
				(req as any).user = payload;
				next();
			} catch (error) {
				return res.status(401).json({ error: 'Unauthorized' });
			}
		}
	}
}

export {
	generateToken,
	AuthRegistry
}