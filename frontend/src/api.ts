export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? `Request failed with status ${response.status}.`);
  }
  return payload;
}
