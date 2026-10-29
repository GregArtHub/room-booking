import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, tokenStore } from '../api/client';
import type { TokenPair, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!tokenStore.access);

  const loadUser = useCallback(async () => {
    const res = await api.get<{ data: User }>('/users/me');
    setUser(res.data);
  }, []);

  useEffect(() => {
    if (!tokenStore.access) return;
    loadUser()
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [loadUser]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ data: TokenPair }>('/auth/login', { email, password });
      tokenStore.set(res.data.accessToken, res.data.refreshToken);
      await loadUser();
    },
    [loadUser],
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      await api.post('/auth/register', { email, password, fullName });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      /* токен мог уже истечь — выходим в любом случае */
    }
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: !!user?.roles.includes('admin'),
      login,
      register,
      logout,
      setUser,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
