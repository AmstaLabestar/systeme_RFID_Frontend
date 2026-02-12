import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/app/types';
import { authService, type SignInPayload, type SignUpPayload } from '@/app/services';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
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
      signOut,
    }),
    [user, token, isLoading, signIn, signUp, signOut],
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
