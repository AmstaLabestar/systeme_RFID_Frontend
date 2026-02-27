import type { AuthUser } from '@/app/types';
import {
  AUTH_ROUTES,
  toAuthResponse,
  toGoogleVerifyPayload,
  toSessionUserResponse,
  toSignInPayload,
  toSignUpPayload,
} from './contracts';
import { authApiClient, toApiErrorMessage } from './httpClient';
import { createId, delay } from './utils';

const GOOGLE_OAUTH_STATE_KEY = 'rfid.oauth.google.state';
const GOOGLE_OAUTH_NONCE_KEY = 'rfid.oauth.google.nonce';
const GOOGLE_OAUTH_REDIRECT_KEY = 'rfid.oauth.google.redirect';
const DEFAULT_REDIRECT_PATH = '/dashboard/overview';
const GOOGLE_CLIENT_ID_PLACEHOLDER = 'your-google-client-id';

export interface SignInPayload {
  identifier: string;
  password: string;
  redirectTo?: string;
}

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface RefreshTokenResponse extends AuthResponse {}

export interface SignInTwoFactorChallenge {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: number;
  expiresAt?: string;
  redirectTo: string;
}

export interface VerifySignInTwoFactorPayload {
  code: string;
  twoFactorToken: string;
  redirectTo?: string;
}

export interface AuthResponse {
  redirectTo?: string;
  user: AuthUser;
}

export interface GoogleOAuthCallbackPayload {
  idToken: string;
  state: string;
}

export interface GoogleOAuthCompleteResponse extends AuthResponse {
  redirectTo: string;
}

export interface MagicLinkRequestPayload {
  email: string;
  redirectTo?: string;
}

export interface MagicLinkRequestResponse {
  success: true;
  message: string;
}

export interface MagicLinkVerifyPayload {
  token: string;
  redirectTo?: string;
}

type AuthResult = AuthResponse | SignInTwoFactorChallenge;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
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

export function isTwoFactorChallenge(value: unknown): value is SignInTwoFactorChallenge {
  if (!isRecord(value) || value.requiresTwoFactor !== true) {
    return false;
  }

  return typeof value.twoFactorToken === 'string' && value.twoFactorToken.length > 0;
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

function normalizeIdentifier(identifier: string): string {
  const normalized = identifier.trim();

  if (normalized.includes('@')) {
    return normalizeEmail(normalized);
  }

  return normalizePhone(normalized);
}

function toSignInTwoFactorChallenge(value: unknown): SignInTwoFactorChallenge {
  if (!isRecord(value) || value.requiresTwoFactor !== true) {
    throw new Error('Reponse 2FA invalide.');
  }

  const token = asString(value.twoFactorToken);
  const expiresIn = Math.max(asNumber(value.expiresIn, 0), 0);
  const redirectTo = asString(value.redirectTo, DEFAULT_REDIRECT_PATH);
  const rawExpiresAt = asString(value.expiresAt);
  const expiresAt =
    rawExpiresAt || (expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined);

  if (!token) {
    throw new Error('Reponse 2FA invalide.');
  }

  return {
    requiresTwoFactor: true,
    twoFactorToken: token,
    expiresIn,
    expiresAt,
    redirectTo,
  };
}

function toAuthResult(value: unknown): AuthResult {
  if (isTwoFactorChallenge(value)) {
    return toSignInTwoFactorChallenge(value);
  }

  return toAuthResponse(value);
}

function toMagicLinkRequestResponse(value: unknown): MagicLinkRequestResponse {
  const source = isRecord(value) ? value : {};
  const success = source.success === true;
  const message = asString(source.message, 'Si cet email existe, le lien a ete envoye.');

  if (!success) {
    throw new Error('Reponse Magic Link invalide.');
  }

  return {
    success: true,
    message,
  };
}

async function withAuthErrorHandling<T>(
  action: () => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(toApiErrorMessage(error, fallbackMessage));
  }
}

export const authService = {
  async getSession(): Promise<AuthUser> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.get<unknown>(AUTH_ROUTES.session);
      return toSessionUserResponse(response.data);
    }, 'Session impossible a recuperer.');
  },

  async signIn(payload: SignInPayload): Promise<AuthResult> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.signIn,
        toSignInPayload({
          identifier: normalizeIdentifier(payload.identifier),
          password: payload.password,
          redirectTo: payload.redirectTo,
        }),
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toAuthResult(response.data);
    }, 'Impossible de se connecter.');
  },

  async signUp(payload: SignUpPayload): Promise<AuthResponse> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.signUp,
        toSignUpPayload({
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          company: payload.company.trim(),
          email: normalizeEmail(payload.email),
          password: payload.password,
          phoneNumber: payload.phoneNumber ? normalizePhone(payload.phoneNumber) : undefined,
        }),
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toAuthResponse(response.data);
    }, 'Impossible de creer le compte.');
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

  async completeGoogleOAuth(
    payload: GoogleOAuthCallbackPayload,
  ): Promise<GoogleOAuthCompleteResponse | SignInTwoFactorChallenge> {
    return withAuthErrorHandling(async () => {
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

      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.googleVerify,
        toGoogleVerifyPayload(payload.idToken),
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      const authResult = toAuthResult(response.data);
      if (isTwoFactorChallenge(authResult)) {
        return {
          ...authResult,
          redirectTo: authResult.redirectTo || redirectTo,
        };
      }

      return {
        ...authResult,
        redirectTo: authResult.redirectTo || redirectTo,
      };
    }, 'Connexion Google impossible.');
  },

  async requestMagicLink(payload: MagicLinkRequestPayload): Promise<MagicLinkRequestResponse> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.magicLink,
        {
          email: normalizeEmail(payload.email),
          redirectTo: payload.redirectTo,
        },
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toMagicLinkRequestResponse(response.data);
    }, 'Envoi du Magic Link impossible.');
  },

  async completeMagicLink(payload: MagicLinkVerifyPayload): Promise<AuthResult> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.magicLinkVerify,
        {
          token: payload.token,
          redirectTo: payload.redirectTo,
        },
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toAuthResult(response.data);
    }, 'Verification du Magic Link impossible.');
  },

  async refresh(refreshToken?: string): Promise<RefreshTokenResponse> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.refresh,
        refreshToken ? { refreshToken } : {},
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toAuthResponse(response.data);
    }, 'Rafraichissement de session impossible.');
  },

  async verifySignInTwoFactor(payload: VerifySignInTwoFactorPayload): Promise<AuthResponse> {
    return withAuthErrorHandling(async () => {
      const response = await authApiClient.post<unknown>(
        AUTH_ROUTES.signInVerify2fa,
        {
          twoFactorToken: payload.twoFactorToken,
          code: payload.code.trim(),
          redirectTo: payload.redirectTo,
        },
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return toAuthResponse(response.data);
    }, 'Verification 2FA impossible.');
  },

  async logout(): Promise<void> {
    await withAuthErrorHandling(async () => {
      await authApiClient.post<{ success: boolean }>(AUTH_ROUTES.logout, {});
    }, 'Deconnexion impossible.');
  },
};
