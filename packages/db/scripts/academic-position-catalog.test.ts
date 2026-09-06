import assert from "node:assert/strict";
import test from "node:test";
import {
    academicCareerReferences,
    academicPositions,
    findAcademicPositionDefinition,
    resolveLegacyAcademicPosition
} from "../src/academicPositionCatalog.js";

test("catálogo possui chaves canônicas únicas", () => {
    assert.equal(
        new Set(academicPositions.map(({ canonicalKey }) => canonicalKey)).size,
        academicPositions.length
    );
    assert.equal(
        new Set(
            academicCareerReferences.map(
                ({ career, code }) => `${career}:${code}`
            )
        ).size,
        academicCareerReferences.length
    );
});

test("reconhece os vínculos não pertencentes à carreira docente", () => {
    assert.equal(
        findAcademicPositionDefinition("02 — POS-DOUTORANDO-OM")?.canonicalKey,
        "postdoctoral:om:02"
    );
    assert.equal(
        findAcademicPositionDefinition("PROFESSOR COLABORADOR")?.canonicalKey,
        "professor:collaborator"
    );
});

test("converte posições legadas sem reduzir códigos de carreira", () => {
    assert.equal(
        resolveLegacyAcademicPosition({
            careerCode: "MS5_2",
            rank: "PROFESSOR_ASSOCIADO_II",
            category: null
        }),
        "ms:ms5.2"
    );
    assert.equal(
        resolveLegacyAcademicPosition({
            careerCode: "B3",
            rank: "PROFESSOR_ASSOCIADO",
            category: "MTS_B"
        }),
        "mts:b3"
    );
    assert.equal(
        resolveLegacyAcademicPosition({
            careerCode: null,
            rank: "PROFESSOR_ASSISTENTE",
            category: null
        }),
        "ms:ms2"
    );
    assert.equal(
        resolveLegacyAcademicPosition({
            careerCode: null,
            rank: "PROFESSOR_PLENO",
            category: "MTS_C"
        }),
        "mts:c1"
    );
});
