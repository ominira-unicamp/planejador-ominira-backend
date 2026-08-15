export const AuthRoles = {
    STUDENT: "STUDENT",
    BOT: "BOT",
    ADMIN: "ADMIN"
} as const;
export type AuthRole = (typeof AuthRoles)[keyof typeof AuthRoles];

export const Capabilities = {
    ACADEMIC_WRITE: "ACADEMIC_WRITE"
} as const;
export type Capability = (typeof Capabilities)[keyof typeof Capabilities];

export const StudentCapabilities = {
    PROFILE_READ: "STUDENT_PROFILE_READ",
    PROFILE_WRITE: "STUDENT_PROFILE_WRITE",
    HISTORY_READ: "STUDENT_HISTORY_READ",
    HISTORY_WRITE: "STUDENT_HISTORY_WRITE",
    PLANNING_READ: "STUDENT_PLANNING_READ",
    PLANNING_WRITE: "STUDENT_PLANNING_WRITE"
} as const;
export type StudentCapability =
    (typeof StudentCapabilities)[keyof typeof StudentCapabilities];

export function raFromDacEmail(email: string | null): string | undefined {
    if (!email) return undefined;
    return /^([a-z])[0-9]{6}@dac\.unicamp\.br$/i.test(email)
        ? email.slice(1, 7)
        : undefined;
}

export type AuthorizationPolicy =
    | { kind: "public" }
    | { kind: "authenticated" }
    | { kind: "admin" }
    | { kind: "capability"; capability: Capability }
    | {
          kind: "student-access";
          studentParam: string;
          capability: StudentCapability;
      }
    | { kind: "student-registration" };

export const policies = {
    public: { kind: "public" } as const,
    authenticated: { kind: "authenticated" } as const,
    admin: { kind: "admin" } as const,
    capability: (capability: Capability): AuthorizationPolicy => ({
        kind: "capability",
        capability
    }),
    studentAccess: (
        studentParam: string,
        capability: StudentCapability
    ): AuthorizationPolicy => ({
        kind: "student-access",
        studentParam,
        capability
    }),
    studentRegistration: { kind: "student-registration" } as const
};
