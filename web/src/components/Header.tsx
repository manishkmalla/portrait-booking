import type { User } from '../types';

export function Header(props: { user: User; onLogout: () => void; loggingOut: boolean }) {
  return (
    <header className="app-header">
      <span className="app-header-identity">
        {props.user.email} ({props.user.role})
      </span>
      <button type="button" onClick={props.onLogout} disabled={props.loggingOut}>
        {props.loggingOut ? 'Logging out…' : 'Logout'}
      </button>
    </header>
  );
}
