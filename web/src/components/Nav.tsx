import type { View } from '../App';
import type { Role } from '../types';

export function Nav(props: { view: View; role: Role; onChange: (view: View) => void }) {
  return (
    <nav className="app-nav">
      <button type="button" className={props.view === 'slots' ? 'active' : ''} onClick={() => props.onChange('slots')}>
        Slots
      </button>
      {props.role === 'client' && (
        <button
          type="button"
          className={props.view === 'my-bookings' ? 'active' : ''}
          onClick={() => props.onChange('my-bookings')}
        >
          My Bookings
        </button>
      )}
      {props.role === 'photographer' && (
        <button
          type="button"
          className={props.view === 'create-slot' ? 'active' : ''}
          onClick={() => props.onChange('create-slot')}
        >
          Create Slot
        </button>
      )}
    </nav>
  );
}
