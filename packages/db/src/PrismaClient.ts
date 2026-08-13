import { PrismaPg } from "@prisma/adapter-pg";
import {
    Prisma as MyPrisma,
    PrismaClient
} from "../prisma/generated/client.js";
export type DatabaseClient = PrismaClient;

export function createDatabaseClient(
    connectionString: string,
    options: Readonly<{ max?: number }> = {}
): DatabaseClient {
    return new PrismaClient({
        adapter: new PrismaPg({ connectionString, ...options })
    });
}

type WhereIdNameType = {
    id?: number | undefined;
    name?: {
        equals: string | undefined;
        mode: "insensitive";
    };
};
function whereIdName(
    id: number | undefined,
    name: string | undefined
): WhereIdNameType {
    return {
        id: id,
        name: {
            equals: name,
            mode: "insensitive"
        }
    };
}

type WhereIdCodeType = {
    id?: number | undefined;
    code?: {
        equals: string | undefined;
        mode: "insensitive";
    };
};
function whereIdCode(
    id: number | undefined,
    code: string | undefined
): WhereIdCodeType {
    return {
        id: id,
        code: {
            equals: code,
            mode: "insensitive"
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

export { MyPrisma, selectIdCode, selectIdName, whereIdCode, whereIdName };
