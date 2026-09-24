import { useEffect, useState } from 'react';
import { BookingListItem } from '../components/BookingListItem';
import { apiFetch } from '../lib/api';
import type { Booking, Paginated } from '../types';

export function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<Booking>>('/api/bookings/me')
      .then((data) => {
        if (cancelled) return;
        setBookings(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setListError(null);
    try {
      const data = await apiFetch<Paginated<Booking>>(`/api/bookings/me?cursor=${encodeURIComponent(nextCursor)}`);
      setBookings((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking)));
      setCancelErrors((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
    } catch (err) {
      setCancelErrors((prev) => ({ ...prev, [bookingId]: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return <p className="loading">Loading…</p>;
  }

  return (
    <section>
      <h2>My Bookings</h2>
      {listError && <p className="error">{listError}</p>}
      <ul className="list">
        {bookings.map((booking) => (
          <BookingListItem
            key={booking.id}
            booking={booking}
            isCancelling={cancellingId === booking.id}
            error={cancelErrors[booking.id] ?? null}
            onCancel={handleCancel}
          />
        ))}
      </ul>
      {nextCursor && (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  );
}
