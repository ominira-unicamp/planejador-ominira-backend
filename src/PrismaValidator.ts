import z from "zod";
import prisma from "./PrismaClient";
async function verifyExists(prismaDelegate: DelageteType, id: number) {
	const entity = await prismaDelegate.findUnique({
		where: {
			id: id
		}
	});
	return entity !== null;
}
async function verifyExistsMany(prismaDelegate: DelageteType, ids: number[]) {
	const entities = await prismaDelegate.findMany({
		where: {
			id: { in: ids }
		}
	});
	return entities.length === ids.length;
}


const buildZodSchemas = (prismaDelegate: DelageteType, uniqueMessage: string, manyMessage: string) => ({
	exists: z.number().int().superRefine(
		async (val, ctx) => {
			if (!await verifyExists(prismaDelegate, val)) {
				ctx.addIssue({
					code: 'custom',
					message: uniqueMessage,
					params: { code: 'REFERENCE_NOT_FOUND' },
				});
			}
		}
	),
	existsMany: z.array(z.number().int()).refine(
		async (vals) => await verifyExistsMany(prismaDelegate, vals),
		{ message: manyMessage, params: { code: 'REFERENCE_NOT_FOUND' } }
	),
})

const zodIds = {
	course: buildZodSchemas(prisma.course, "Course not found", "One or more courses not found"),
	studyPeriod: buildZodSchemas(prisma.studyPeriod, "Study period not found", "One or more study periods not found"),
	professor: buildZodSchemas(prisma.professor, "Professor not found", "One or more professors not found"),
	room: buildZodSchemas(prisma.room, "Room not found", "One or more rooms not found"),
	class: buildZodSchemas(prisma.class, "Class not found", "One or more classes not found"),
	classSchedule: buildZodSchemas(prisma.classSchedule, "Class schedule not found", "One or more class schedules not found"),
	institute: buildZodSchemas(prisma.institute, "Institute not found", "One or more institutes not found"),
}

type DelageteType = {
	findUnique(args: { where: { id: number } }): Promise<any | null>,
	findMany(args: { where: { id: { in: number[] } } }): Promise<any[]>
}

export {
	zodIds,
}

