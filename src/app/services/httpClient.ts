import axios, { AxiosError } from 'axios';

const DEFAULT_SYSTEM_API_BASE_URL = 'http://localhost:4011';
const AUTH_TOKEN_STORAGE_KEY = 'rfid.auth.token';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getSystemApiBaseUrl(): string {
  const envBaseUrl = import.meta.env.VITE_SYSTEM_API_URL || import.meta.env.VITE_AUTH_API_URL;
  return normalizeBaseUrl(envBaseUrl || DEFAULT_SYSTEM_API_BASE_URL);
}

export const systemApiClient = axios.create({
  baseURL: getSystemApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

systemApiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) {
    return config;
  }

  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;

  return config;
});

export function toApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const apiMessage = axiosError.response?.data?.message;

    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage;
    }

    if (axiosError.code === 'ERR_NETWORK') {
      return 'Serveur API indisponible. Lancez `npm run dev:api` puis reessayez.';
    }
  }

  return fallbackMessage;
}
