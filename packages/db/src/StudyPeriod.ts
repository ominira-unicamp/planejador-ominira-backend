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

export function parseStudyPeriodCode(value: string): {
    year: number;
    yearPeriod: YearPeriods;
} | null {
    const match = /^(\d{4})(s1|s2|v|i)$/i.exec(value.trim());
    if (!match) return null;
    const yearPeriod = {
        s1: YearPeriods.FIRST_SEMESTER,
        s2: YearPeriods.SECOND_SEMESTER,
        v: YearPeriods.SUMMER,
        i: YearPeriods.WINTER
    }[match[2].toLowerCase()];
    if (!yearPeriod) return null;
    return { year: Number(match[1]), yearPeriod };
}
