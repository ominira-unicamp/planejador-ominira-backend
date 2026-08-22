import assert from "node:assert/strict";
import test from "node:test";
import {
    legacyCourseCode,
    normalizeCourseCode
} from "../src/services/course-code.js";

test("preserves the significant space in Physics course codes", () => {
    assert.equal(normalizeCourseCode("F 328"), "F 328");
    assert.equal(normalizeCourseCode("F328"), "F 328");
    assert.equal(normalizeCourseCode("  F   328*"), "F 328");
    assert.equal(normalizeCourseCode("F 328* "), "F 328");
    assert.equal(legacyCourseCode("F 328"), "F328");
});

test("keeps regular course codes compact", () => {
    assert.equal(normalizeCourseCode("MC 102"), "MC102");
    assert.equal(normalizeCourseCode("LA093"), "LA093");
});
