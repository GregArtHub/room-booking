export type RoleName = 'guest' | 'employee' | 'admin';
export type Locale = 'ru' | 'en';
export type Theme = 'light' | 'dark' | 'system';
export type BookingStatus = 'ACTIVE' | 'CANCELLED';
export type NotificationType = 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_CANCELLED';

export interface Meta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: Meta;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: RoleName[];
  isBlocked: boolean;
  locale: Locale;
  theme: Theme;
  createdAt: string;
}

export interface Amenity {
  id: number;
  name: string;
}

export interface Room {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  floor: number;
  photoUrl: string | null;
  isActive: boolean;
  amenities: Amenity[];
}

export interface Booking {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  room: Room;
  user: { id: number; fullName: string };
  createdAt: string;
}

export interface BusySlot {
  id: number;
  startsAt: string;
  endsAt: string;
}

export interface AppNotification {
  id: number;
  type: NotificationType;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalBookings: number;
  averageDurationMinutes: number;
  topRoom: { roomId: number; name: string; bookings: number } | null;
  byDay: { date: string; bookings: number }[];
  byRoom: { roomId: number; name: string; hoursBooked: number }[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
