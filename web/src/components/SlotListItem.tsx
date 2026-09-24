import type { Slot } from '../types';

export function SlotListItem(props: {
  slot: Slot;
  isClient: boolean;
  isBooking: boolean;
  error: string | null;
  onBook: (slotId: string) => void;
}) {
  const { slot } = props;

  return (
    <li className="list-row">
      <div className="list-row-main">
        <span>
          {new Date(slot.startsAt).toLocaleString()} – {new Date(slot.endsAt).toLocaleString()}
        </span>
        <span>
          {slot.remaining} / {slot.capacity} remaining
        </span>
      </div>
      {props.isClient && (
        <button type="button" disabled={slot.remaining === 0 || props.isBooking} onClick={() => props.onBook(slot.id)}>
          {props.isBooking ? 'Booking…' : 'Book'}
        </button>
      )}
      {props.error && <p className="error">{props.error}</p>}
    </li>
  );
}
