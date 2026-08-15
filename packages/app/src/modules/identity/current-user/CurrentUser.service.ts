import type { Principal } from "#/auth.js";
import entity from "#/modules/identity/current-user/CurrentUser.entity.js";

export type CurrentUserService = {
    get(principal: Principal): ReturnType<typeof entity.build>;
};

export function createCurrentUserService(): CurrentUserService {
    return { get: entity.build };
}
