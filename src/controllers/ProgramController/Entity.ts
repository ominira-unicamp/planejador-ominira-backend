import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/ProgramInterface.js";
import { MyPrisma, selectIdCode } from "../../PrismaClient.js";

export const prismaProgramFieldSelection = {
    include: {
        unit: selectIdCode,
        _count: {
            select: {
                catalogPrograms: true,
                students: true
            }
        }
    }
} as const satisfies MyPrisma.ProgramDefaultArgs;

type PrismaProgramPayload = MyPrisma.ProgramGetPayload<
    typeof prismaProgramFieldSelection
>;

function relatedPathsForProgram(program: PrismaProgramPayload) {
    return {
        self: resourcesPaths.program.entity(program.id),
        unit: resourcesPaths.unit.entity(program.unit.id)
    };
}

function buildProgramEntity(
    program: PrismaProgramPayload
): z.infer<typeof IO.schema> {
    const { unit, _count, ...rest } = program;
    return {
        ...rest,
        unit,
        catalogProgramsCount: _count.catalogPrograms,
        studentsCount: _count.students,
        _paths: relatedPathsForProgram(program)
    };
}

export default {
    build: buildProgramEntity,
    prismaSelection: prismaProgramFieldSelection
};
