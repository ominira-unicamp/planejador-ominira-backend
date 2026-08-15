import type { Principal } from "#/auth.js";
import IO from "#/modules/identity/current-user/CurrentUser.contract.js";
import z from "zod";

function build(principal: Principal): z.infer<typeof IO.schemas.entity> {
    return {
        id: principal.authUserId,
        roles: [...principal.roles],
        capabilities: [...principal.capabilities],
        studentId: principal.studentId
    };
}

export default { build };
