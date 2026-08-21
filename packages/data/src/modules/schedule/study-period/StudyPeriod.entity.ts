import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import { MyPrisma, studyPeriodCode } from "@pomi/db";
import z from "zod";

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
        code: studyPeriodCode(studyPeriod.year, studyPeriod.yearPeriod),
        _paths: relatedPathsForStudyPeriod(studyPeriod.id)
    };
}

export default {
    build: buildStudyPeriodEntity
};
