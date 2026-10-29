import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Amenity, Paginated, Room } from '../api/types';
import { RoomCard } from '../components/RoomCard';
import { EmptyState, ErrorState, Input, PageLoader, Pagination, Select } from '../components/ui';
import { useDebounce } from '../lib/useDebounce';

const LIMIT = 6;

export default function RoomsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [floor, setFloor] = useState('');
  const [sort, setSort] = useState('name');
  const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get<{ data: Amenity[] }>('/amenities'),
  });

  const params = {
    search: debouncedSearch.trim(),
    minCapacity,
    floor,
    sort,
    amenities: amenityIds.join(','),
    page,
    limit: LIMIT,
  };
  const rooms = useQuery({
    queryKey: ['rooms', params],
    queryFn: () => api.get<Paginated<Room>>('/rooms', params),
    placeholderData: (prev) => prev,
  });

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function toggleAmenity(id: number) {
    setAmenityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setPage(1);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('rooms.title')}</h1>

      <div className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('common.search')}
            placeholder={t('rooms.searchPlaceholder')}
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
          <Select
            label={t('rooms.minCapacity')}
            value={minCapacity}
            onChange={(e) => resetPage(setMinCapacity)(e.target.value)}
          >
            <option value="">{t('rooms.any')}</option>
            {[2, 4, 6, 8, 10, 12, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select
            label={t('rooms.floor')}
            value={floor}
            onChange={(e) => resetPage(setFloor)(e.target.value)}
          >
            <option value="">{t('rooms.any')}</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select
            label={t('rooms.sort')}
            value={sort}
            onChange={(e) => resetPage(setSort)(e.target.value)}
          >
            <option value="name">{t('rooms.sortName')}</option>
            <option value="-capacity">{t('rooms.sortCapacityDesc')}</option>
            <option value="capacity">{t('rooms.sortCapacityAsc')}</option>
            <option value="floor">{t('rooms.sortFloor')}</option>
          </Select>
        </div>
        {amenities.data && amenities.data.data.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('rooms.amenities')}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {amenities.data.data.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={amenityIds.includes(a.id)}
                    onChange={() => toggleAmenity(a.id)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {rooms.isLoading ? (
        <PageLoader />
      ) : rooms.isError ? (
        <ErrorState onRetry={() => rooms.refetch()} />
      ) : rooms.data && rooms.data.data.length === 0 ? (
        <EmptyState title={t('rooms.none')} hint={t('rooms.noneHint')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.data?.data.map((room) => (
              <RoomCard key={room.id} room={room} />
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
    </div>
  );
}
