import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/SpecializationInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

export const prismaSpecializationFieldSelection = {
    include: {
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
        self: resourcesPaths.specialization.entity(specialization.id)
    };
}

function buildSpecializationEntity(
    specialization: PrismaSpecializationPayload
): z.infer<typeof IO.schema> {
    const { _count, ...rest } = specialization;
    return {
        ...rest,
        catalogSpecializationsCount: _count.catalogSpecializations,
        studentsCount: _count.students,
        _paths: relatedPathsForSpecialization(specialization)
    };
}

export default {
    build: buildSpecializationEntity,
    prismaSelection: prismaSpecializationFieldSelection
};
