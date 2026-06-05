import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/StudyPeriodsInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PrismaStudyPeriodPayload = MyPrisma.StudyPeriodGetPayload<{}>;

const relatedPathsForStudyPeriod = (studyPeriodId: number) => {
    return {
        classes: resourcesPaths.class.list({
            studyPeriodId: studyPeriodId
        }),
        classSchedules: resourcesPaths.classSchedule.list({
            studyPeriodId: studyPeriodId
        })
    };
};

function buildStudyPeriodEntity(
    studyPeriod: PrismaStudyPeriodPayload
): z.infer<typeof IO.schema> {
    return {
        ...studyPeriod,
        _paths: relatedPathsForStudyPeriod(studyPeriod.id)
    };
}

export default {
    build: buildStudyPeriodEntity
};
