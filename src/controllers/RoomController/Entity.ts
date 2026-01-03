import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import { MyPrisma } from '../../PrismaClient.js'

extendZodWithOpenApi(z);

type PrismaRoomPayload = MyPrisma.RoomGetPayload<{}>;

function buildRoomEntity(room: PrismaRoomPayload): z.infer<typeof roomEntity> {
	return {
		...room,
		_paths: {
			entity: `/rooms/${room.id}`,
		}
	};
}

const roomEntity = z.object({
	id: z.number().int(),
	code: z.string(),
	_paths: z.object({
		entity: z.string(),
	})
}).strict().openapi('RoomEntity');

export default {
	schema: roomEntity,
	build: buildRoomEntity
}
