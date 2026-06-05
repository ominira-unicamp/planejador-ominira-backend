import z from "zod";
import IO from "../../Interfaces/ProfessorInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

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
