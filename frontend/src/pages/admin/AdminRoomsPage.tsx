import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, fieldErrors } from '../../api/client';
import type { Amenity, Paginated, Room } from '../../api/types';
import { RoomPhoto } from '../../components/RoomCard';
import { useToast } from '../../components/Toast';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageLoader,
  Pagination,
  TextArea,
} from '../../components/ui';
import { useDebounce } from '../../lib/useDebounce';

const LIMIT = 6;
const MAX_PHOTO_MB = 5;

interface RoomFormProps {
  room: Room | null;
  amenities: Amenity[];
  onSaved: () => void;
  onCancel: () => void;
}

function RoomForm({ room, amenities, onSaved, onCancel }: RoomFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(room?.name ?? '');
  const [description, setDescription] = useState(room?.description ?? '');
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 8));
  const [floor, setFloor] = useState(String(room?.floor ?? 1));
  const [isActive, setIsActive] = useState(room?.isActive ?? true);
  const [amenityIds, setAmenityIds] = useState<number[]>(room?.amenities.map((a) => a.id) ?? []);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 100) next.name = t('adminRooms.nameLength');
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 200)
      next.capacity = t('adminRooms.capacityRange');
    if (!Number.isInteger(Number(floor)) || floor.trim() === '')
      next.floor = t('adminRooms.floorInt');
    if (photo && !['image/jpeg', 'image/png'].includes(photo.type))
      next.photo = t('profile.fileTypeError');
    else if (photo && photo.size > MAX_PHOTO_MB * 1024 * 1024)
      next.photo = t('profile.fileSizeError', { mb: MAX_PHOTO_MB });
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        capacity: Number(capacity),
        floor: Number(floor),
        isActive,
        amenityIds,
      };
      const res = room
        ? await api.patch<{ data: Room }>(`/rooms/${room.id}`, body)
        : await api.post<{ data: Room }>('/rooms', body);
      if (photo) await api.upload(`/rooms/${res.data.id}/photo`, photo);
      toast.push(t('common.saved'));
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, t('common.somethingWrong')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label={t('adminRooms.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <TextArea
        label={t('adminRooms.description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('adminRooms.capacity')}
          type="number"
          min={1}
          max={200}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          error={errors.capacity}
        />
        <Input
          label={t('adminRooms.floor')}
          type="number"
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          error={errors.floor}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t('adminRooms.active')}
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t('adminRooms.amenities')}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {amenities.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={amenityIds.includes(a.id)}
                onChange={() =>
                  setAmenityIds((prev) =>
                    prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                  )
                }
              />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="room-photo">
          {t('adminRooms.photo')}{' '}
          <span className="text-xs text-slate-500">({t('profile.avatarHint')})</span>
        </label>
        <input
          id="room-photo"
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {errors.photo && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.photo}
          </p>
        )}
      </div>
      {formError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={loading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

export default function AdminRoomsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const debounced = useDebounce(search);

  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get<{ data: Amenity[] }>('/amenities'),
  });
  const params = { search: debounced.trim(), includeInactive, page, limit: LIMIT, sort: 'name' };
  const rooms = useQuery({
    queryKey: ['rooms', 'admin', params],
    queryFn: () => api.get<Paginated<Room>>('/rooms', params),
    placeholderData: (prev) => prev,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/rooms/${id}`),
    onSuccess: () => {
      toast.push(t('adminRooms.deleted'));
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err) => {
      toast.push(errorMessage(err, t('common.somethingWrong')), 'error');
      setDeleting(null);
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rooms'] });
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('adminRooms.title')}</h1>
        <Button onClick={() => setCreating(true)}>{t('adminRooms.create')}</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Input
          className="w-full sm:w-72"
          label={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setPage(1);
            }}
          />
          {t('adminRooms.includeInactive')}
        </label>
      </div>

      {rooms.isLoading ? (
        <PageLoader />
      ) : rooms.isError ? (
        <ErrorState onRetry={() => rooms.refetch()} />
      ) : rooms.data && rooms.data.data.length === 0 ? (
        <EmptyState title={t('adminRooms.empty')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.data?.data.map((room) => (
              <Card key={room.id} className="flex flex-col gap-3">
                <RoomPhoto room={room} className="h-32" />
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{room.name}</h2>
                  {!room.isActive && <Badge tone="slate">{t('rooms.inactive')}</Badge>}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t('rooms.seats', { count: room.capacity })} ·{' '}
                  {t('rooms.floorLabel', { count: room.floor })}
                </p>
                <div className="mt-auto flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(room)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(room)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {rooms.data && (
            <Pagination
              page={page}
              limit={LIMIT}
              total={rooms.data.meta.total}
              onChange={setPage}
            />
          )}
        </>
      )}

      <Modal
        open={creating || !!editing}
        title={editing ? t('adminRooms.edit') : t('adminRooms.create')}
        onClose={closeForm}
      >
        {(creating || editing) && (
          <RoomForm
            key={editing?.id ?? 'new'}
            room={editing}
            amenities={amenities.data?.data ?? []}
            onSaved={() => {
              closeForm();
              refresh();
            }}
            onCancel={closeForm}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={t('adminRooms.deleteTitle')}
        message={t('adminRooms.deleteMessage', { name: deleting?.name ?? '' })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
