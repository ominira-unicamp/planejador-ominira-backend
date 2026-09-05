import type { StudentCourseAttemptStatus } from "./StudentCourseAttempt.contract.js";

export function isAttemptApprovedForPrerequisite(
    status: (typeof StudentCourseAttemptStatus)[keyof typeof StudentCourseAttemptStatus]
): boolean {
    return [
        "APPROVED",
        "APPROVED_BY_ATTENDANCE",
        "APPROVED_BY_PROFICIENCY",
        "SUFFICIENT"
    ].includes(status);
}
