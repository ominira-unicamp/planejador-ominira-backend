import { PrismaClient } from '../../prisma/generated/client.js'

declare global {
	namespace Express {
		interface Request {
			prisma: PrismaClient;
		}
	}
}