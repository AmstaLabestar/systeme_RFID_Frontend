import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/app/types';
import {
  authService,
  type GoogleOAuthCallbackPayload,
  type SignInPayload,
  type SignUpPayload,
  type WhatsAppOtpRequestPayload,
  type WhatsAppOtpRequestResponse,
  type WhatsAppOtpVerifyPayload,
} from '@/app/services';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  startGoogleOAuth: (redirectTo?: string) => void;
  completeGoogleOAuth: (payload: GoogleOAuthCallbackPayload) => Promise<string>;
  requestWhatsAppOtp: (payload: WhatsAppOtpRequestPayload) => Promise<WhatsAppOtpRequestResponse>;
  verifyWhatsAppOtp: (payload: WhatsAppOtpVerifyPayload) => Promise<void>;
  signOut: () => void;
}

const STORAGE_TOKEN_KEY = 'rfid.auth.token';
const STORAGE_USER_KEY = 'rfid.auth.user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawToken = window.localStorage.getItem(STORAGE_TOKEN_KEY);
    const rawUser = window.localStorage.getItem(STORAGE_USER_KEY);

    if (rawToken && rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser) as AuthUser;
        setToken(rawToken);
        setUser(parsedUser);
      } catch {
        window.localStorage.removeItem(STORAGE_TOKEN_KEY);
        window.localStorage.removeItem(STORAGE_USER_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
  }, []);

  const signIn = useCallback(
    async (payload: SignInPayload) => {
      const response = await authService.signIn(payload);
      persistSession(response.token, response.user);
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      const response = await authService.signUp(payload);
      persistSession(response.token, response.user);
    },
    [persistSession],
  );

  const startGoogleOAuth = useCallback((redirectTo?: string) => {
    authService.startGoogleOAuth(redirectTo);
  }, []);

  const completeGoogleOAuth = useCallback(
    async (payload: GoogleOAuthCallbackPayload): Promise<string> => {
      const response = await authService.completeGoogleOAuth(payload);
      persistSession(response.token, response.user);
      return response.redirectTo;
    },
    [persistSession],
  );

  const requestWhatsAppOtp = useCallback(async (payload: WhatsAppOtpRequestPayload) => {
    return authService.requestWhatsAppOtp(payload);
  }, []);

  const verifyWhatsAppOtp = useCallback(async (payload: WhatsAppOtpVerifyPayload) => {
    const response = await authService.verifyWhatsAppOtp(payload);
    persistSession(response.token, response.user);
  }, [persistSession]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(STORAGE_TOKEN_KEY);
    window.localStorage.removeItem(STORAGE_USER_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      signIn,
      signUp,
      startGoogleOAuth,
      completeGoogleOAuth,
      requestWhatsAppOtp,
      verifyWhatsAppOtp,
      signOut,
    }),
    [user, token, isLoading, signIn, signUp, startGoogleOAuth, completeGoogleOAuth, requestWhatsAppOtp, verifyWhatsAppOtp, signOut],
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
