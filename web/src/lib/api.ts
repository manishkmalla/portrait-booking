interface ErrorBody {
  error: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value && typeof (value as ErrorBody).error === 'string';
}

// Generic JSON fetch wrapper: the caller's type argument T describes the
// expected response shape (there's no runtime schema to check it against).
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message = isErrorBody(body) ? body.error : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return body as T;
}
