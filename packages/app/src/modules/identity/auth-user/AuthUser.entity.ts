import IO from "#/modules/identity/auth-user/AuthUser.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaAuthUserSelection = {
    include: {
        roles: true,
        capabilities: true
    }
} as const satisfies MyPrisma.AuthUserDefaultArgs;

type AuthUserPayload = MyPrisma.AuthUserGetPayload<
    typeof prismaAuthUserSelection
>;

function build(authUser: AuthUserPayload): z.infer<typeof IO.schemas.entity> {
    return {
        id: authUser.id,
        issuer: authUser.issuer,
        subject: authUser.subject,
        email: authUser.email,
        displayName: authUser.displayName,
        status: authUser.status,
        roles: authUser.roles,
        capabilities: authUser.capabilities
    };
}

export default {
    build,
    prismaSelection: prismaAuthUserSelection
};
