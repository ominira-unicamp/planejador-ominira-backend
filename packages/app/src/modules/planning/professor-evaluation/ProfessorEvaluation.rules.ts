import type { StudentCourseAttemptStatus } from "@pomi/db";

export function isEligibleProfessorEvaluationAttempt(
    status: StudentCourseAttemptStatus
) {
    return [
        "DROPPED",
        "APPROVED",
        "FAILED_BY_GRADE",
        "APPROVED_BY_ATTENDANCE",
        "FAILED_BY_ATTENDANCE",
        "SUFFICIENT",
        "INSUFFICIENT"
    ].includes(status);
}
