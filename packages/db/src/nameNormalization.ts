export function normalizeProfessorName(name: string) {
    return name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/\s+/gu, " ")
        .trim();
}

function canonicalProfessorName(name: string) {
    return name.replace(/\s+/gu, " ").trim();
}

function diacriticCount(name: string) {
    return name.normalize("NFD").match(/\p{M}/gu)?.length ?? 0;
}

export function preferProfessorName(left: string, right: string) {
    const normalizedLeft = canonicalProfessorName(left);
    const normalizedRight = canonicalProfessorName(right);
    const difference =
        diacriticCount(normalizedRight) - diacriticCount(normalizedLeft);
    if (difference !== 0)
        return difference > 0 ? normalizedRight : normalizedLeft;
    return normalizedRight.localeCompare(normalizedLeft, "pt-BR") < 0
        ? normalizedRight
        : normalizedLeft;
}
