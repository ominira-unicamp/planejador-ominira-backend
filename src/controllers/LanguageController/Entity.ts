import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'
import { resourcesPaths } from '../../Controllers.js';

extendZodWithOpenApi(z);

export const prismaLanguageFieldSelection = {
	include: {
		_count: {
			select: {
				catalogLanguages: true,
			}
		}
	},
} as const satisfies MyPrisma.LanguageDefaultArgs;

type PrismaLanguagePayload = MyPrisma.LanguageGetPayload<typeof prismaLanguageFieldSelection>;

function relatedPathsForLanguage(language: PrismaLanguagePayload) {
	return {
		self: resourcesPaths.language.entity(language.id),
	}
}

function buildLanguageEntity(language: PrismaLanguagePayload): z.infer<typeof schema> {
	const { _count, ...rest } = language;
	return {
		...rest,
		catalogLanguagesCount: _count.catalogLanguages,
		_paths: relatedPathsForLanguage(language),
	};
}

const schema = z.object({
	id: z.number().int(),
	name: z.string(),
	catalogLanguagesCount: z.number().int(),
	_paths: z.object({
		self: z.string(),
	}),
}).openapi('Language');

const languageEntity = {
	build: buildLanguageEntity,
	prismaSelection: prismaLanguageFieldSelection,
	schema: schema
}

export default languageEntity;
