interface ApiRequestConfig {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
}

interface ApiErrorBody {
  message?: string;
}

// Shared API entry point to keep the frontend ready for backend REST integration.
export async function apiRequest<T>({ endpoint, method = 'GET', token, body }: ApiRequestConfig): Promise<T> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Serveur API indisponible. Lancez `npm run dev:api` puis reessayez.');
  }

  if (!response.ok) {
    let apiErrorMessage = '';

    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      apiErrorMessage = typeof errorBody?.message === 'string' ? errorBody.message : '';
    } catch {
      apiErrorMessage = '';
    }

    throw new Error(apiErrorMessage || `API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
