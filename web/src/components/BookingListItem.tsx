import type { Booking } from '../types';

export function BookingListItem(props: {
  booking: Booking;
  isCancelling: boolean;
  error: string | null;
  onCancel: (bookingId: string) => void;
}) {
  const { booking } = props;

  return (
    <li className="list-row">
      <div className="list-row-main">
        <span>
          {new Date(booking.startsAt).toLocaleString()} – {new Date(booking.endsAt).toLocaleString()}
        </span>
        <span className={`status status-${booking.status}`}>{booking.status}</span>
      </div>
      {booking.status === 'confirmed' && (
        <button type="button" disabled={props.isCancelling} onClick={() => props.onCancel(booking.id)}>
          {props.isCancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
      {props.error && <p className="error">{props.error}</p>}
    </li>
  );
}
