import IO from "#/modules/catalog/program/Program.contract.js";
import programEntity from "#/modules/catalog/program/Program.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Program = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
export type ProgramService = {
    list(query: Query): Promise<Program[]>;
    getById(
        id: number
    ): Promise<
        Result<Program, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createProgramService({
    prisma
}: {
    prisma: PrismaClient;
}): ProgramService {
    return {
        async list(query) {
            return (
                await prisma.program.findMany({
                    ...programEntity.prismaSelection,
                    where: query.unitId ? { unitId: query.unitId } : {},
                    orderBy: { name: "asc" }
                })
            ).map(programEntity.build);
        },
        async getById(id) {
            const program = await prisma.program.findUnique({
                ...programEntity.prismaSelection,
                where: { id }
            });
            return program
                ? ok(programEntity.build(program))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Program not found"
                      })
                  );
        }
    };
}
