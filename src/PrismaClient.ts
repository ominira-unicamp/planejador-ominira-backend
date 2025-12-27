import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient,  Prisma as MyPrisma } from '../prisma/generated/client'
import * as models from '../prisma/generated/zod/schemas/models/index'
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: pool })


type WhereIdNameType = {
	id?: number | undefined,
	name?: {
		equals: string | undefined
		mode: 'insensitive'
	},
}
function whereIdName(id : number | undefined, name: string | undefined) : WhereIdNameType{
	return {
		id: id,
		name: {
			equals: name,
			mode: 'insensitive',
		}
	};
}

type WhereIdCodeType = {
	id?: number | undefined,
	code?: {
		equals: string | undefined
		mode: 'insensitive'
	},
}
function whereIdCode(id : number | undefined, code: string | undefined) : WhereIdCodeType {
	return {
		id: id,
		code: {
			equals: code,
			mode: 'insensitive',
		}
	};
}

const selectIdName = {
	select: {
		id: true,
		name: true
	}
} as const;
const selectIdCode = {
	select: {
		id: true,
		code: true
	}
} as const;


export default prisma
export {
	MyPrisma, 
	models,
	whereIdCode,
	whereIdName,
	selectIdCode,
	selectIdName
}