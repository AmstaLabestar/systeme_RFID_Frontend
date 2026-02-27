import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AUTH_ROUTES } from './contracts';

const DEFAULT_API_BASE_URL = 'http://localhost:4012';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getAuthApiBaseUrl(): string {
  return normalizeBaseUrl(import.meta.env.VITE_AUTH_API_URL || DEFAULT_API_BASE_URL);
}

function getSystemApiBaseUrl(): string {
  const envBaseUrl = import.meta.env.VITE_SYSTEM_API_URL || import.meta.env.VITE_AUTH_API_URL;
  return normalizeBaseUrl(envBaseUrl || DEFAULT_API_BASE_URL);
}

function extractApiMessage(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(payload)) {
    const parts = payload
      .map((entry) => extractApiMessage(entry))
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  if (typeof payload === 'object') {
    const source = payload as Record<string, unknown>;
    return (
      extractApiMessage(source.message) ||
      extractApiMessage(source.error) ||
      extractApiMessage(source.details) ||
      null
    );
  }

  return null;
}

async function refreshSessionCookie(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${getAuthApiBaseUrl()}${AUTH_ROUTES.refresh}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        },
      )
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function attachAuthInterceptors(client: ReturnType<typeof axios.create>): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || !error.config) {
        return Promise.reject(error);
      }

      const axiosError = error as AxiosError<{ message?: string }>;
      const requestConfig = axiosError.config as RetriableRequestConfig;
      const status = axiosError.response?.status;
      const requestUrl = requestConfig.url || '';
      const isRefreshRequest = requestUrl.includes(AUTH_ROUTES.refresh);

      if (
        status !== 401 ||
        requestConfig._retry ||
        requestConfig._skipAuthRefresh ||
        isRefreshRequest
      ) {
        return Promise.reject(error);
      }

      const didRefresh = await refreshSessionCookie();
      if (!didRefresh) {
        return Promise.reject(error);
      }

      requestConfig._retry = true;
      return client.request(requestConfig);
    },
  );
}

export const authApiClient = axios.create({
  baseURL: getAuthApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const systemApiClient = axios.create({
  baseURL: getSystemApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

attachAuthInterceptors(authApiClient);
attachAuthInterceptors(systemApiClient);

export function toApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const apiMessage =
      extractApiMessage(axiosError.response?.data) || extractApiMessage(axiosError.message);

    if (apiMessage) {
      return apiMessage;
    }

    if (axiosError.code === 'ERR_NETWORK') {
      const target = `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`.replace(
        /\/+$/,
        '',
      );
      return `Impossible de joindre l API (${target || 'backend'}). Verifiez que \`npm run dev:backend\` est lance et que CORS est autorise.`;
    }

    return fallbackMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
