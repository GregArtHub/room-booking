import { Prisma } from '@prisma/client';

export const roomInclude = {
  amenities: { include: { amenity: true } },
} satisfies Prisma.RoomInclude;

export type RoomWithAmenities = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

export function toRoomDto(room: RoomWithAmenities) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    floor: room.floor,
    photoUrl: room.photoUrl,
    isActive: room.isActive,
    amenities: room.amenities.map((a) => ({ id: a.amenity.id, name: a.amenity.name })),
  };
}
