interface ApiRequestConfig {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
}

// Shared API entry point to keep the frontend ready for backend REST integration.
export async function apiRequest<T>({ endpoint, method = 'GET', token, body }: ApiRequestConfig): Promise<T> {
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
