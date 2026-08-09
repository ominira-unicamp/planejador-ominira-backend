import { Router, type Request, type Response } from "express";
import z from "zod";
import {
    AuthRoles,
    Capabilities,
    ForbiddenError,
    StudentCapabilities,
    type StudentCapability
} from "../../auth.js";

const router = Router();

const studentCapabilities = Object.values(StudentCapabilities) as [
    StudentCapability,
    ...StudentCapability[]
];
const capabilityValues = Object.values(Capabilities) as ["ACADEMIC_WRITE"];

function principal(req: Request) {
    if (!req.principal) throw new ForbiddenError();
    return req.principal;
}

function requireStudent(req: Request): NonNullable<Request["principal"]> & {
    studentId: number;
} {
    const current = principal(req);
    if (current.studentId === null) throw new ForbiddenError();
    return { ...current, studentId: current.studentId };
}

router.get("/me", (req: Request, res: Response) => {
    const current = principal(req);
    return res.json({
        id: current.authUserId,
        roles: [...current.roles],
        capabilities: [...current.capabilities],
        studentId: current.studentId
    });
});

router.get("/bots", async (req: Request, res: Response) => {
    principal(req);
    const bots = await req.prisma.authUser.findMany({
        where: {
            status: "ACTIVE",
            roles: { some: { role: AuthRoles.BOT } }
        },
        select: { id: true, displayName: true }
    });
    return res.json(bots);
});

router.get("/me/bot-grants", async (req: Request, res: Response) => {
    const current = requireStudent(req);
    const grants = await req.prisma.botGrant.findMany({
        where: { studentId: current.studentId },
        include: {
            botAuthUser: { select: { id: true, displayName: true } }
        },
        orderBy: { createdAt: "desc" }
    });
    return res.json(grants);
});

const replaceGrantsBody = z
    .object({ capabilities: z.array(z.enum(studentCapabilities)) })
    .strict();

router.put(
    "/me/bot-grants/:botAuthUserId",
    async (req: Request, res: Response) => {
        const current = requireStudent(req);
        const botId = z.coerce
            .number()
            .int()
            .safeParse(req.params.botAuthUserId);
        const body = replaceGrantsBody.safeParse(req.body);
        if (!botId.success || !body.success) {
            return res.status(400).json({ error: "Invalid bot grant" });
        }

        const bot = await req.prisma.authUser.findFirst({
            where: {
                id: botId.data,
                status: "ACTIVE",
                roles: { some: { role: AuthRoles.BOT } }
            },
            select: { id: true }
        });
        if (!bot) return res.status(404).json({ error: "Bot not found" });

        const capabilities = [...new Set(body.data.capabilities)];
        await req.prisma.$transaction(async (tx) => {
            await tx.botGrant.updateMany({
                where: {
                    studentId: current.studentId,
                    botAuthUserId: bot.id,
                    revokedAt: null,
                    ...(capabilities.length > 0
                        ? { capability: { notIn: capabilities } }
                        : {})
                },
                data: {
                    revokedAt: new Date(),
                    revokedByAuthUserId: current.authUserId
                }
            });

            const activeGrants = await tx.botGrant.findMany({
                where: {
                    studentId: current.studentId,
                    botAuthUserId: bot.id,
                    revokedAt: null
                },
                select: { capability: true }
            });
            const active = new Set(
                activeGrants.map((grant) => grant.capability)
            );
            const missing = capabilities.filter(
                (capability) => !active.has(capability)
            );
            if (missing.length > 0) {
                await tx.botGrant.createMany({
                    data: missing.map((capability) => ({
                        studentId: current.studentId!,
                        botAuthUserId: bot.id,
                        capability,
                        grantedByAuthUserId: current.authUserId
                    }))
                });
            }
        });

        return res.status(204).send();
    }
);

const createBotBody = z
    .object({
        subject: z.string().min(1),
        displayName: z.string().min(1).max(200),
        capabilities: z.array(z.enum(capabilityValues)).default([])
    })
    .strict();

router.get("/admin/auth-users", async (req: Request, res: Response) => {
    principal(req);
    const users = await req.prisma.authUser.findMany({
        include: {
            roles: true,
            capabilities: true,
            student: { select: { id: true } }
        },
        orderBy: { id: "asc" }
    });
    return res.json(users);
});

router.post("/admin/auth-users", async (req: Request, res: Response) => {
    const current = principal(req);
    const body = createBotBody.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: "Invalid auth user" });

    const authUser = await req.prisma.authUser.upsert({
        where: {
            issuer_subject: {
                issuer: current.issuer,
                subject: body.data.subject
            }
        },
        create: {
            issuer: current.issuer,
            subject: body.data.subject,
            displayName: body.data.displayName,
            roles: { create: { role: AuthRoles.BOT } },
            capabilities: {
                create: body.data.capabilities.map((capability) => ({
                    capability
                }))
            }
        },
        update: {
            displayName: body.data.displayName,
            status: "ACTIVE"
        },
        include: { roles: true, capabilities: true }
    });
    await req.prisma.authUserRole.upsert({
        where: {
            authUserId_role: {
                authUserId: authUser.id,
                role: AuthRoles.BOT
            }
        },
        create: { authUserId: authUser.id, role: AuthRoles.BOT },
        update: {}
    });
    return res.status(201).json(authUser);
});

const patchAuthUserBody = z
    .object({
        status: z.enum(["ACTIVE", "DISABLED"]).optional(),
        displayName: z.string().min(1).max(200).optional(),
        capabilities: z.array(z.enum(capabilityValues)).optional()
    })
    .strict();

router.patch("/admin/auth-users/:id", async (req: Request, res: Response) => {
    principal(req);
    const id = z.coerce.number().int().safeParse(req.params.id);
    const body = patchAuthUserBody.safeParse(req.body);
    if (!id.success || !body.success)
        return res.status(400).json({ error: "Invalid auth user" });

    const existing = await req.prisma.authUser.findUnique({
        where: { id: id.data },
        include: { roles: true }
    });
    if (!existing)
        return res.status(404).json({ error: "Auth user not found" });
    if (existing.roles.some((role) => role.role === AuthRoles.ADMIN)) {
        return res
            .status(403)
            .json({ error: "Admin identities are managed by CLI" });
    }

    const authUser = await req.prisma.$transaction(async (tx) => {
        if (body.data.capabilities) {
            await tx.authUserCapability.deleteMany({
                where: { authUserId: existing.id }
            });
            await tx.authUserCapability.createMany({
                data: body.data.capabilities.map((capability) => ({
                    authUserId: existing.id,
                    capability
                }))
            });
        }
        return tx.authUser.update({
            where: { id: existing.id },
            data: {
                ...(body.data.status ? { status: body.data.status } : {}),
                ...(body.data.displayName
                    ? { displayName: body.data.displayName }
                    : {})
            },
            include: { roles: true, capabilities: true }
        });
    });
    return res.json(authUser);
});

export default { router };
