import IO from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import studyPeriodEntity from "#/modules/schedule/study-period/StudyPeriod.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type StudyPeriod = z.infer<typeof IO.schema>;
export type StudyPeriodService = {
    list(): Promise<StudyPeriod[]>;
    getById(
        id: number
    ): Promise<
        Result<StudyPeriod, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createStudyPeriodService({
    prisma
}: {
    prisma: PrismaClient;
}): StudyPeriodService {
    return {
        async list() {
            return (await prisma.studyPeriod.findMany()).map(
                studyPeriodEntity.build
            );
        },
        async getById(id) {
            const value = await prisma.studyPeriod.findUnique({
                where: { id }
            });
            return value
                ? ok(studyPeriodEntity.build(value))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Study period not found"
                      })
                  );
        }
    };
}
