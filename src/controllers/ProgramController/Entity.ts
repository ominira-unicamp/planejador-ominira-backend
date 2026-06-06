import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/ProgramInterface.js";
import { MyPrisma, selectIdCode } from "../../PrismaClient.js";

export const prismaProgramFieldSelection = {
    include: {
        institute: selectIdCode,
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
        institute: resourcesPaths.institute.entity(program.institute.id)
    };
}

function buildProgramEntity(
    program: PrismaProgramPayload
): z.infer<typeof IO.schema> {
    const { institute, _count, ...rest } = program;
    return {
        ...rest,
        institute,
        catalogProgramsCount: _count.catalogPrograms,
        studentsCount: _count.students,
        _paths: relatedPathsForProgram(program)
    };
}

export default {
    build: buildProgramEntity,
    prismaSelection: prismaProgramFieldSelection
};
