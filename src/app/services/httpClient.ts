import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AUTH_ROUTES } from './contracts';

const DEFAULT_API_BASE_URL = 'http://localhost:4012';
const AUTH_TOKEN_STORAGE_KEY = 'rfid.auth.token';
const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'rfid.auth.refreshToken';
const AUTH_USER_STORAGE_KEY = 'rfid.auth.user';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
  _skipAuthHeader?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

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

function hasAuthorizationHeader(config: RetriableRequestConfig): boolean {
  const headers = config.headers as Record<string, unknown> | undefined;
  const authorization = headers?.Authorization ?? headers?.authorization;
  return typeof authorization === 'string' && authorization.trim().length > 0;
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

function readAuthTokens(payload: unknown): { accessToken: string | null; refreshToken: string | null } {
  const source = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const nested = typeof source.data === 'object' && source.data !== null
    ? (source.data as Record<string, unknown>)
    : {};

  const accessCandidate =
    nested.token ??
    nested.accessToken ??
    nested.access_token ??
    source.token ??
    source.accessToken ??
    source.access_token;
  const refreshCandidate =
    nested.refreshToken ?? nested.refresh_token ?? source.refreshToken ?? source.refresh_token;

  const accessToken = typeof accessCandidate === 'string' ? accessCandidate.trim() : '';
  const refreshToken = typeof refreshCandidate === 'string' ? refreshCandidate.trim() : '';

  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  };
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

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedRefreshToken = window.localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  if (!storedRefreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${getAuthApiBaseUrl()}${AUTH_ROUTES.refresh}`,
        { refreshToken: storedRefreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .then((response) => {
        const tokens = readAuthTokens(response.data);

        if (!tokens.accessToken) {
          clearStoredSession();
          return null;
        }

        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, tokens.accessToken);
        if (tokens.refreshToken) {
          window.localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
        }

        return tokens.accessToken;
      })
      .catch(() => {
        clearStoredSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function attachAuthInterceptors(client: ReturnType<typeof axios.create>): void {
  client.interceptors.request.use((config) => {
    const requestConfig = config as RetriableRequestConfig;
    if (typeof window === 'undefined' || requestConfig._skipAuthHeader) {
      return requestConfig;
    }

    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) {
      return requestConfig;
    }

    requestConfig.headers = requestConfig.headers ?? {};
    (requestConfig.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    return requestConfig;
  });

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
        isRefreshRequest ||
        !hasAuthorizationHeader(requestConfig)
      ) {
        return Promise.reject(error);
      }

      const refreshedAccessToken = await refreshAccessToken();
      if (!refreshedAccessToken) {
        return Promise.reject(error);
      }

      requestConfig._retry = true;
      requestConfig.headers = requestConfig.headers ?? {};
      (requestConfig.headers as Record<string, string>).Authorization = `Bearer ${refreshedAccessToken}`;

      return client.request(requestConfig);
    },
  );
}

export const authApiClient = axios.create({
  baseURL: getAuthApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const systemApiClient = axios.create({
  baseURL: getSystemApiBaseUrl(),
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
