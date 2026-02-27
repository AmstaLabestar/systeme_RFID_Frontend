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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const persistSession = useCallback((response: AuthResponse) => {
    queryClient.clear();
    setUser(response.user);
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const sessionUser = await authService.getSession();

        if (!isMounted) {
          return;
        }

        setUser(sessionUser);
      } catch {
        if (!isMounted) {
          return;
        }
        clearSession();
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
  }, [clearSession]);

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
    void authService.logout().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
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
