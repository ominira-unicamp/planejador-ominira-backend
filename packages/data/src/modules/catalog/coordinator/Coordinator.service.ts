import IO from "#/modules/catalog/coordinator/Coordinator.contract.js";
import coordinatorEntity from "#/modules/catalog/coordinator/Coordinator.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Coordinator = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

export type CoordinatorService = {
    list(query: Query): Promise<{ items: Coordinator[]; total: number }>;
    getById(
        id: number
    ): Promise<
        Result<Coordinator, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};

export function createCoordinatorService({
    prisma
}: {
    prisma: PrismaClient;
}): CoordinatorService {
    return {
        async list(query) {
            const where = query.name
                ? {
                      name: {
                          contains: query.name,
                          mode: "insensitive" as const
                      }
                  }
                : {};
            const total = await prisma.coordinator.count({ where });
            const coordinators = await prisma.coordinator.findMany({
                ...(query.page !== undefined || query.pageSize !== undefined
                    ? {
                          skip:
                              ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                          take: query.pageSize ?? 20
                      }
                    : {}),
                ...coordinatorEntity.selection,
                where,
                orderBy: { name: "asc" }
            });
            return {
                items: coordinators.map(coordinatorEntity.build),
                total
            };
        },
        async getById(id) {
            const coordinator = await prisma.coordinator.findUnique({
                ...coordinatorEntity.selection,
                where: { id }
            });
            return coordinator
                ? ok(coordinatorEntity.build(coordinator))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Coordinator not found"
                      })
                  );
        }
    };
}
