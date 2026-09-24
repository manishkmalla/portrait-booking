import { useEffect, useMemo, useState } from 'react';
import { Calendar } from '../components/Calendar';
import { SlotListItem } from '../components/SlotListItem';
import { apiFetch } from '../lib/api';
import { fromDateKey, startOfMonth, toDateKey } from '../lib/date';
import type { Paginated, Role, Slot } from '../types';

export function SlotsPage(props: { role: Role }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookErrors, setBookErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadAllSlots() {
      const all: Slot[] = [];
      let cursor: string | undefined;
      do {
        const data: Paginated<Slot> = await apiFetch(`/api/slots${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        all.push(...data.items);
        cursor = data.nextCursor ?? undefined;
      } while (cursor && !cancelled);
      return all;
    }

    loadAllSlots()
      .then((all) => {
        if (cancelled) return;
        setSlots(all);
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

  const slotsByDate = useMemo(() => {
    const grouped: Record<string, Slot[]> = {};
    for (const slot of slots) {
      const dateKey = toDateKey(new Date(slot.startsAt));
      (grouped[dateKey] ??= []).push(slot);
    }
    return grouped;
  }, [slots]);

  // Once slots load, jump straight to the earliest day with availability
  // instead of showing an empty calendar the user has to click into.
  useEffect(() => {
    if (selectedDate !== null || loading) return;
    const earliestDateKey = Object.keys(slotsByDate).sort()[0];
    if (!earliestDateKey) return;
    setSelectedDate(earliestDateKey);
    setVisibleMonth(startOfMonth(fromDateKey(earliestDateKey)));
  }, [loading, slotsByDate, selectedDate]);

  async function handleBook(slotId: string) {
    setBookingSlotId(slotId);
    try {
      await apiFetch(`/api/slots/${slotId}/bookings`, { method: 'POST' });
      setSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, remaining: slot.remaining - 1 } : slot)));
      setBookErrors((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
    } catch (err) {
      setBookErrors((prev) => ({ ...prev, [slotId]: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setBookingSlotId(null);
    }
  }

  if (loading) {
    return <p className="loading">Loading…</p>;
  }

  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  return (
    <section>
      <h2>Slots</h2>
      {listError && <p className="error">{listError}</p>}
      <Calendar
        month={visibleMonth}
        slotsByDate={slotsByDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onMonthChange={setVisibleMonth}
      />
      {/* selectedDate is only ever set (by click or auto-select below) to a
          date-key present in slotsByDate, so selectedSlots is never empty
          here — the fallback below only covers "nothing selected yet". */}
      {selectedDate && selectedSlots[0] ? (
        <>
          <h3>{new Date(selectedSlots[0].startsAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <ul className="list">
            {selectedSlots.map((slot) => (
              <SlotListItem
                key={slot.id}
                slot={slot}
                isClient={props.role === 'client'}
                isBooking={bookingSlotId === slot.id}
                error={bookErrors[slot.id] ?? null}
                onBook={handleBook}
              />
            ))}
          </ul>
        </>
      ) : (
        <p>No upcoming availability. Pick a marked day above, or check back later.</p>
      )}
    </section>
  );
}
