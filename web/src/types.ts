export type Role = 'client' | 'photographer';

export type User = {
  id: string;
  email: string;
  role: Role;
};

export type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  remaining: number;
};

export type BookingStatus = 'confirmed' | 'cancelled';

export type Booking = {
  id: string;
  status: BookingStatus;
  slotId: string;
  startsAt: string;
  endsAt: string;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};
