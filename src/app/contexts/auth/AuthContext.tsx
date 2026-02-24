import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@/app/types';
import {
  authService,
  type AuthResponse,
  type GoogleOAuthCallbackPayload,
  type MagicLinkRequestPayload,
  type MagicLinkRequestResponse,
  type MagicLinkVerifyPayload,
  type SignInPayload,
  type SignInTwoFactorChallenge,
  type SignUpPayload,
  type VerifySignInTwoFactorPayload,
  isTwoFactorChallenge,
} from '@/app/services';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: SignInPayload) => Promise<AuthResponse | SignInTwoFactorChallenge>;
  verifySignInTwoFactor: (payload: VerifySignInTwoFactorPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  startGoogleOAuth: (redirectTo?: string) => void;
  completeGoogleOAuth: (
    payload: GoogleOAuthCallbackPayload,
  ) => Promise<AuthResponse | SignInTwoFactorChallenge>;
  requestMagicLink: (payload: MagicLinkRequestPayload) => Promise<MagicLinkRequestResponse>;
  completeMagicLink: (payload: MagicLinkVerifyPayload) => Promise<AuthResponse | SignInTwoFactorChallenge>;
  signOut: () => void;
}

const STORAGE_TOKEN_KEY = 'rfid.auth.token';
const STORAGE_REFRESH_TOKEN_KEY = 'rfid.auth.refreshToken';
const STORAGE_USER_KEY = 'rfid.auth.user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(STORAGE_TOKEN_KEY);
    window.localStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(STORAGE_USER_KEY);
    queryClient.clear();
  }, [queryClient]);

  const persistSession = useCallback((response: AuthResponse) => {
    queryClient.clear();
    setToken(response.token);
    setUser(response.user);
    window.localStorage.setItem(STORAGE_TOKEN_KEY, response.token);
    window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(response.user));

    if (response.refreshToken) {
      window.localStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, response.refreshToken);
    } else {
      window.localStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY);
    }
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const rawToken = window.localStorage.getItem(STORAGE_TOKEN_KEY);
      const rawRefreshToken = window.localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);

      if (!rawToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const sessionUser = await authService.getSession(rawToken);

        if (!isMounted) {
          return;
        }

        setToken(rawToken);
        setUser(sessionUser);
        window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(sessionUser));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (!rawRefreshToken) {
          clearSession();
          return;
        }

        try {
          const refreshed = await authService.refresh(rawRefreshToken);
          persistSession(refreshed);
        } catch {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession, persistSession]);

  const signIn = useCallback(
    async (payload: SignInPayload) => {
      const response = await authService.signIn(payload);
      if (!isTwoFactorChallenge(response)) {
        persistSession(response);
      }
      return response;
    },
    [persistSession],
  );

  const verifySignInTwoFactor = useCallback(
    async (payload: VerifySignInTwoFactorPayload) => {
      const response = await authService.verifySignInTwoFactor(payload);
      persistSession(response);
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      const response = await authService.signUp(payload);
      persistSession(response);
    },
    [persistSession],
  );

  const startGoogleOAuth = useCallback((redirectTo?: string) => {
    authService.startGoogleOAuth(redirectTo);
  }, []);

  const completeGoogleOAuth = useCallback(
    async (payload: GoogleOAuthCallbackPayload): Promise<AuthResponse | SignInTwoFactorChallenge> => {
      const response = await authService.completeGoogleOAuth(payload);
      if (!isTwoFactorChallenge(response)) {
        persistSession(response);
      }
      return response;
    },
    [persistSession],
  );

  const requestMagicLink = useCallback(async (payload: MagicLinkRequestPayload) => {
    return authService.requestMagicLink(payload);
  }, []);

  const completeMagicLink = useCallback(
    async (payload: MagicLinkVerifyPayload): Promise<AuthResponse | SignInTwoFactorChallenge> => {
      const response = await authService.completeMagicLink(payload);
      if (!isTwoFactorChallenge(response)) {
        persistSession(response);
      }
      return response;
    },
    [persistSession],
  );

  const signOut = useCallback(() => {
    const currentToken = token;
    const currentRefreshToken = window.localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY) || undefined;

    if (currentToken) {
      void authService.logout(currentToken, currentRefreshToken).catch(() => undefined);
    }

    clearSession();
  }, [clearSession, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      signIn,
      verifySignInTwoFactor,
      signUp,
      startGoogleOAuth,
      completeGoogleOAuth,
      requestMagicLink,
      completeMagicLink,
      signOut,
    }),
    [
      user,
      token,
      isLoading,
      signIn,
      verifySignInTwoFactor,
      signUp,
      startGoogleOAuth,
      completeGoogleOAuth,
      requestMagicLink,
      completeMagicLink,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
