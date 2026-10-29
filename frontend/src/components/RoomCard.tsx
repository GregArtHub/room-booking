import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Room } from '../api/types';
import { Badge, Card } from './ui';

export function RoomPhoto({ room, className = 'h-40' }: { room: Room; className?: string }) {
  const { t } = useTranslation();
  return room.photoUrl ? (
    <img
      src={room.photoUrl}
      alt={room.name}
      loading="lazy"
      className={`w-full rounded-md object-cover ${className}`}
    />
  ) : (
    <div
      className={`flex w-full items-center justify-center rounded-md bg-slate-200 text-sm text-slate-500 dark:bg-slate-700 ${className}`}
    >
      {t('rooms.noPhoto')}
    </div>
  );
}

export function RoomCard({ room }: { room: Room }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3">
      <RoomPhoto room={room} />
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{room.name}</h2>
        {!room.isActive && <Badge tone="slate">{t('rooms.inactive')}</Badge>}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t('rooms.seats', { count: room.capacity })} ·{' '}
        {t('rooms.floorLabel', { count: room.floor })}
      </p>
      {room.description && <p className="line-clamp-2 text-sm">{room.description}</p>}
      {room.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {room.amenities.map((a) => (
            <Badge key={a.id} tone="indigo">
              {a.name}
            </Badge>
          ))}
        </div>
      )}
      <Link
        to={`/rooms/${room.id}`}
        className="mt-auto inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {t('rooms.open')}
      </Link>
    </Card>
  );
}
