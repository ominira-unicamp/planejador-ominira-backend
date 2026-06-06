import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/InstituteInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaInstitutePayload = MyPrisma.InstituteGetPayload<{}>;

function relatedPathsForInstitute(instituteId: number) {
    return {
        classes: resourcesPaths.class.list({
            instituteId: instituteId
        }),
        courses: resourcesPaths.course.list({ instituteId: instituteId })
    };
}

function buildInstituteEntity(
    institute: PrismaInstitutePayload
): z.infer<typeof IO.schema> {
    return {
        ...institute,
        _paths: relatedPathsForInstitute(institute.id)
    };
}

export default {
    build: buildInstituteEntity
};
