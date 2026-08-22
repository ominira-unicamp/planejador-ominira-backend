export function normalizeCourseCode(value: string) {
    const compact = value
        .replace(/\s+/g, "")
        .replace(/\*+$/g, "")
        .toUpperCase();
    const physicsCourse = /^F(\d{3,4})$/.exec(compact);
    return physicsCourse ? `F ${physicsCourse[1]}` : compact;
}

export function legacyCourseCode(code: string) {
    return code.replace(/^F\s+(\d{3,4})$/, "F$1");
}
