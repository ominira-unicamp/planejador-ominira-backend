import type {
    SpecializationFilter,
    SpecializationFilterName
} from "#/modules/catalog/specialization/Specialization.contract.js";
import IO from "#/modules/catalog/specialization/Specialization.contract.js";
import specializationEntity from "#/modules/catalog/specialization/Specialization.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type Specialization = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

const specializationWhere = prismaWhereFor<MyPrisma.SpecializationWhereInput>();
const specializationWhereDefinitions = {
    programId: specializationWhere.numberAt("program.id"),
    programCode: specializationWhere.numberAt("program.code"),
    code: specializationWhere.stringAt("code")
} satisfies Record<
    SpecializationFilterName,
    FilterWhereBuilder<MyPrisma.SpecializationWhereInput>
>;

export function specializationFilterWhere(
    filter: SpecializationFilter | undefined
): MyPrisma.SpecializationWhereInput[] {
    return compileFilterWhere(
        filter,
        specializationWhereDefinitions,
        "specialization"
    );
}
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
            const filterWhere = specializationFilterWhere(query.filter);
            return (
                await prisma.specialization.findMany({
                    ...specializationEntity.prismaSelection,
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {},
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
