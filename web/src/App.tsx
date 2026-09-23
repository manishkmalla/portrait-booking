import { useEffect, useState } from 'react';
import { apiFetch } from './lib/api';

interface HealthResponse {
  status: string;
  db: string;
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>('/api/health')
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'));
  }, []);

  return (
    <main>
      <h1>Portrait Booking</h1>
      {error && <p>Error: {error}</p>}
      {!error && !health && <p>Loading...</p>}
      {health && (
        <p>
          API status: {health.status}, db: {health.db}
        </p>
      )}
    </main>
  );
}
