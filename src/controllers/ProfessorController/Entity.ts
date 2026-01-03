import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'

extendZodWithOpenApi(z);

type PrismaProfessorPayload = MyPrisma.ProfessorGetPayload<{}>;

function buildProfessorEntity(professor: PrismaProfessorPayload): z.infer<typeof professorEntity> {
	return {
		...professor,
		_paths: {
			entity: `/professors/${professor.id}`,
		}
	};
}

const professorEntity = z.object({
	id: z.number().int(),
	name: z.string(),
	_paths: z.object({
		entity: z.string(),
	})
}).strict().openapi('ProfessorEntity');

export default {
	schema: professorEntity,
	build: buildProfessorEntity
}
