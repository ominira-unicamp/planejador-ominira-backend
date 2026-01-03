import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z, {  } from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

type PrismaStudyPeriodPayload = MyPrisma.StudyPeriodGetPayload<{}>;


const relatedPathsForStudyPeriod = (studyPeriodId: number) => {
	return {
		classes: resourcesPaths.class.list({
			studyPeriodId: studyPeriodId
		}),
		classSchedules: resourcesPaths.classSchedule.list({
			studyPeriodId: studyPeriodId
		}),
	}
}

function buildStudyPeriodEntity(studyPeriod: PrismaStudyPeriodPayload): z.infer<typeof studyPeriodEntity> {
	return {
		...studyPeriod,
		_paths: relatedPathsForStudyPeriod(studyPeriod.id)
	};
}

const studyPeriodEntity = z.object({
	id: z.number().int(),
	code: z.string(),
	startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
	_paths: z.object({
		classes: z.string(),
		classSchedules: z.string(),
	})
}).strict().openapi('StudyPeriodEntity');

export default {
	schema: studyPeriodEntity,
	build: buildStudyPeriodEntity
}

