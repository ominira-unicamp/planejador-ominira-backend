import IO from "#/modules/catalog/specialization/Specialization.contract.js";
import specializationEntity from "#/modules/catalog/specialization/Specialization.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Specialization = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
export type SpecializationService = {
    list(query: Query): Promise<Specialization[]>;
    getById(
        id: number
    ): Promise<
        Result<
            Specialization,
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
};
export function createSpecializationService({
    prisma
}: {
    prisma: PrismaClient;
}): SpecializationService {
    return {
        async list(query) {
            return (
                await prisma.specialization.findMany({
                    ...specializationEntity.prismaSelection,
                    where: {
                        program: {
                            id: query.programId,
                            code: query.programCode
                        },
                        code: query.code
                    },
                    orderBy: [{ program: { code: "asc" } }, { name: "asc" }]
                })
            ).map(specializationEntity.build);
        },
        async getById(id) {
            const specialization = await prisma.specialization.findUnique({
                ...specializationEntity.prismaSelection,
                where: { id }
            });
            return specialization
                ? ok(specializationEntity.build(specialization))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Specialization not found"
                      })
                  );
        }
    };
}
