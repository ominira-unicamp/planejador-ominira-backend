import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, ReferenceNotFoundProblemSchema } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const studentPath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("tag-interests")
];

const studentTagPath = [...studentPath, pathSeg.param("tagId")];

const studentId = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int().positive())
});

const studentTagId = studentId.extend({
    tagId: z.string().pipe(z.coerce.number()).pipe(z.number().int().positive())
});

const tag = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        categoryId: z.number().int().positive(),
        parentTagId: z.number().int().positive().nullable()
    })
    .strict()
    .openapi("StudentTagInterest");

const list = {
    meta: {
        method: "get" as const,
        path: studentPath,
        tags: ["student-tag-interests"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PROFILE_READ
        )
    },
    request: z.object({ path: studentId }),
    response: new OutputBuilder()
        .ok(z.array(tag), "Interesses por tags recuperados")
        .build()
} satisfies IO;

const put = {
    meta: {
        method: "put" as const,
        path: studentTagPath,
        tags: ["student-tag-interests"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PROFILE_WRITE
        )
    },
    request: z.object({ path: studentTagId }),
    response: new OutputBuilder()
        .noContent("Interesse por tag adicionado")
        .problem(422, ReferenceNotFoundProblemSchema, "Tag não encontrada")
        .build()
} satisfies IO;

const remove = {
    meta: {
        method: "delete" as const,
        path: studentTagPath,
        tags: ["student-tag-interests"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PROFILE_WRITE
        )
    },
    request: z.object({ path: studentTagId }),
    response: new OutputBuilder()
        .noContent("Interesse por tag removido")
        .build()
} satisfies IO;

export default { list, put, remove };
