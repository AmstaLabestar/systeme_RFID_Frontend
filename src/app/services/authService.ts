import type { AuthUser } from '@/app/types';
import {
  AUTH_ROUTES,
  toAuthResponse,
  toGoogleVerifyPayload,
  toSessionUserResponse,
  toSignInPayload,
  toSignUpPayload,
  toWhatsAppOtpRequestResponse,
  toWhatsAppRequestPayload,
  toWhatsAppVerifyPayload,
} from './contracts';
import { apiRequest } from './apiClient';
import { createId, delay } from './utils';

const GOOGLE_OAUTH_STATE_KEY = 'rfid.oauth.google.state';
const GOOGLE_OAUTH_NONCE_KEY = 'rfid.oauth.google.nonce';
const GOOGLE_OAUTH_REDIRECT_KEY = 'rfid.oauth.google.redirect';
const DEFAULT_REDIRECT_PATH = '/dashboard/overview';
const DEFAULT_AUTH_API_BASE_URL = 'http://localhost:4011';
const GOOGLE_CLIENT_ID_PLACEHOLDER = 'your-google-client-id';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface GoogleOAuthCallbackPayload {
  idToken: string;
  state: string;
}

export interface GoogleOAuthCompleteResponse extends AuthResponse {
  redirectTo: string;
}

export interface WhatsAppOtpRequestPayload {
  phone: string;
}

export interface WhatsAppOtpRequestResponse {
  requestId: string;
  expiresAt: string;
  debugCode?: string;
}

export interface WhatsAppOtpVerifyPayload {
  requestId: string;
  phone: string;
  code: string;
}

interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  nonce?: string;
}

function getAuthApiBaseUrl(): string {
  return (import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_BASE_URL).replace(/\/+$/, '');
}

export function isGoogleOAuthConfigured(): boolean {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return false;
  }

  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) {
    return false;
  }

  return !normalizedClientId.includes(GOOGLE_CLIENT_ID_PLACEHOLDER);
}

function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuth non configure: ajoutez VITE_GOOGLE_CLIENT_ID dans votre .env.local.');
  }

  return clientId.trim();
}

function getGoogleRedirectUri(): string {
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/google/callback`;
}

function decodeGoogleIdToken(idToken: string): GoogleIdTokenPayload {
  const segments = idToken.split('.');

  if (segments.length < 2 || !segments[1]) {
    throw new Error('Token Google invalide.');
  }

  const base64Payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
  const binaryPayload = window.atob(paddedPayload);
  const bytes = Uint8Array.from(binaryPayload, (char) => char.charCodeAt(0));
  const jsonPayload = new TextDecoder().decode(bytes);

  try {
    return JSON.parse(jsonPayload) as GoogleIdTokenPayload;
  } catch {
    throw new Error('Impossible de lire les informations Google.');
  }
}

function consumeGoogleOAuthState(state: string): { expectedNonce: string; redirectTo: string } {
  const expectedState = window.sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
  const expectedNonce = window.sessionStorage.getItem(GOOGLE_OAUTH_NONCE_KEY);
  const redirectTo = window.sessionStorage.getItem(GOOGLE_OAUTH_REDIRECT_KEY) || DEFAULT_REDIRECT_PATH;

  window.sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(GOOGLE_OAUTH_NONCE_KEY);
  window.sessionStorage.removeItem(GOOGLE_OAUTH_REDIRECT_KEY);

  if (!expectedState || expectedState !== state) {
    throw new Error('Session Google expiree. Relancez la connexion.');
  }

  if (!expectedNonce) {
    throw new Error('Nonce OAuth manquant. Relancez la connexion Google.');
  }

  return {
    expectedNonce,
    redirectTo,
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authService = {
  async getSession(token: string): Promise<AuthUser> {
    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.session}`,
      token,
    });
    return toSessionUserResponse(response);
  },

  async signIn(payload: SignInPayload): Promise<AuthResponse> {
    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.signIn}`,
      method: 'POST',
      body: toSignInPayload({
        email: normalizeEmail(payload.email),
        password: payload.password,
      }),
    });

    return toAuthResponse(response);
  },

  async signUp(payload: SignUpPayload): Promise<AuthResponse> {
    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.signUp}`,
      method: 'POST',
      body: toSignUpPayload({
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        company: payload.company.trim(),
        email: normalizeEmail(payload.email),
        password: payload.password,
      }),
    });

    return toAuthResponse(response);
  },

  startGoogleOAuth(redirectTo = DEFAULT_REDIRECT_PATH): void {
    const clientId = getGoogleClientId();
    const state = createId('state');
    const nonce = createId('nonce');
    const redirectUri = getGoogleRedirectUri();

    window.sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
    window.sessionStorage.setItem(GOOGLE_OAUTH_NONCE_KEY, nonce);
    window.sessionStorage.setItem(GOOGLE_OAUTH_REDIRECT_KEY, redirectTo);

    const searchParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
      nonce,
    });

    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`);
  },

  async completeGoogleOAuth(payload: GoogleOAuthCallbackPayload): Promise<GoogleOAuthCompleteResponse> {
    await delay(120);

    const { expectedNonce, redirectTo } = consumeGoogleOAuthState(payload.state);
    const decodedPayload = decodeGoogleIdToken(payload.idToken);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const validIssuer =
      decodedPayload.iss === 'https://accounts.google.com' || decodedPayload.iss === 'accounts.google.com';

    if (!validIssuer) {
      throw new Error('Issuer Google invalide.');
    }

    if (decodedPayload.aud !== getGoogleClientId()) {
      throw new Error('Le token Google ne correspond pas a ce client.');
    }

    if (decodedPayload.exp <= nowInSeconds) {
      throw new Error('Le token Google a expire.');
    }

    if (decodedPayload.nonce !== expectedNonce) {
      throw new Error('Nonce Google invalide.');
    }

    if (!decodedPayload.email) {
      throw new Error('Email Google manquant dans le token.');
    }

    if (decodedPayload.email_verified === false) {
      throw new Error('Votre email Google doit etre verifie pour continuer.');
    }

    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.googleVerify}`,
      method: 'POST',
      body: toGoogleVerifyPayload(payload.idToken),
    });
    const authResponse = toAuthResponse(response);

    return {
      ...authResponse,
      redirectTo,
    };
  },

  async requestWhatsAppOtp(payload: WhatsAppOtpRequestPayload): Promise<WhatsAppOtpRequestResponse> {
    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.whatsappRequest}`,
      method: 'POST',
      body: toWhatsAppRequestPayload(normalizePhone(payload.phone)),
    });

    return toWhatsAppOtpRequestResponse(response);
  },

  async verifyWhatsAppOtp(payload: WhatsAppOtpVerifyPayload): Promise<AuthResponse> {
    const response = await apiRequest<unknown>({
      endpoint: `${getAuthApiBaseUrl()}${AUTH_ROUTES.whatsappVerify}`,
      method: 'POST',
      body: toWhatsAppVerifyPayload({
        requestId: payload.requestId,
        code: payload.code,
        phone: normalizePhone(payload.phone),
      }),
    });

    return toAuthResponse(response);
  },
};
