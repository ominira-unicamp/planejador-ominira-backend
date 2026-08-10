import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/academic/contracts/ProfessorInterface.js";
import z from "zod";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaProfessorPayload = MyPrisma.ProfessorGetPayload<{}>;

function buildProfessorEntity(
    professor: PrismaProfessorPayload
): z.infer<typeof IO.schema> {
    return {
        ...professor,
        _paths: {
            entity: `/professors/${professor.id}`
        }
    };
}

export default {
    build: buildProfessorEntity
};
