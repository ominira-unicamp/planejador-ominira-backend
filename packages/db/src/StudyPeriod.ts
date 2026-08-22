import { YearPeriods } from "../prisma/generated/client.js";

export function studyPeriodCode(year: number, yearPeriod: YearPeriods): string {
    const suffix = {
        [YearPeriods.FIRST_SEMESTER]: "s1",
        [YearPeriods.SECOND_SEMESTER]: "s2",
        [YearPeriods.SUMMER]: "v",
        [YearPeriods.WINTER]: "i"
    }[yearPeriod];
    return `${year}${suffix}`;
}
