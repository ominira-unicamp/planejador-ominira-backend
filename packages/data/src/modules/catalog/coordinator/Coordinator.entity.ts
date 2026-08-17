import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/catalog/coordinator/Coordinator.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaCoordinatorSelection = {
    include: {
        _count: { select: { catalogCourses: true } }
    }
} as const satisfies MyPrisma.CoordinatorDefaultArgs;

type PrismaCoordinatorPayload = MyPrisma.CoordinatorGetPayload<
    typeof prismaCoordinatorSelection
>;

function buildCoordinatorEntity(
    coordinator: PrismaCoordinatorPayload
): z.infer<typeof IO.schema> {
    return {
        id: coordinator.id,
        name: coordinator.name,
        catalogCoursesCount: coordinator._count.catalogCourses,
        _paths: {
            self: resourcesPaths.coordinator.entity(coordinator.id),
            catalogCourses: resourcesPaths.catalogCourse.list({
                coordinatorId: coordinator.id
            })
        }
    };
}

export default {
    build: buildCoordinatorEntity,
    selection: prismaCoordinatorSelection
};
