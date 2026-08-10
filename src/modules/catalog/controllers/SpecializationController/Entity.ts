import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/catalog/contracts/SpecializationInterface.js";
import z from "zod";

export const prismaSpecializationFieldSelection = {
    include: {
        program: {
            select: {
                id: true,
                code: true,
                name: true
            }
        },
        _count: {
            select: {
                catalogSpecializations: true,
                students: true
            }
        }
    }
} as const satisfies MyPrisma.SpecializationDefaultArgs;

type PrismaSpecializationPayload = MyPrisma.SpecializationGetPayload<
    typeof prismaSpecializationFieldSelection
>;

function relatedPathsForSpecialization(
    specialization: PrismaSpecializationPayload
) {
    return {
        self: `/specializations/${specialization.id}`,
        program: `/programs/${specialization.program.id}`
    };
}

function buildSpecializationEntity(
    specialization: PrismaSpecializationPayload
): z.infer<typeof IO.schema> {
    const { _count, program, ...rest } = specialization;
    return {
        ...rest,
        programCode: program.code,
        programName: program.name,
        catalogSpecializationsCount: _count.catalogSpecializations,
        studentsCount: _count.students,
        _paths: relatedPathsForSpecialization(specialization)
    };
}

export default {
    build: buildSpecializationEntity,
    prismaSelection: prismaSpecializationFieldSelection
};
