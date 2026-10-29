import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;
  try {
    const res = await axios.post('/api/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefresh } = res.data.data;
    tokenStore.set(accessToken, newRefresh);
    return accessToken as string;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthCall &&
      tokenStore.refresh
    ) {
      original._retry = true;
      refreshing ??= doRefresh().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      }
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  },
);

export const api = {
  get: async <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
    (await http.get<T>(url, { params: clean(params) })).data,
  post: async <T>(url: string, body?: unknown): Promise<T> => (await http.post<T>(url, body)).data,
  patch: async <T>(url: string, body?: unknown): Promise<T> =>
    (await http.patch<T>(url, body)).data,
  del: async (url: string): Promise<void> => {
    await http.delete(url);
  },
  upload: async <T>(url: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append('file', file);
    return (await http.post<T>(url, form)).data;
  },
};

/** Убирает пустые параметры запроса (undefined, null, пустая строка). */
function clean(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: { field?: string; message: string }[] };
}

export function errorMessage(e: unknown, fallback: string): string {
  const body = (e as AxiosError<ApiErrorBody>)?.response?.data;
  return body?.error?.message ?? fallback;
}

export function errorCode(e: unknown): string | undefined {
  return (e as AxiosError<ApiErrorBody>)?.response?.data?.error?.code;
}

/** Ошибки валидации сервера по полям: { fieldName: message }. */
export function fieldErrors(e: unknown): Record<string, string> {
  const details = (e as AxiosError<ApiErrorBody>)?.response?.data?.error?.details ?? [];
  const result: Record<string, string> = {};
  for (const d of details) if (d.field && !result[d.field]) result[d.field] = d.message;
  return result;
}
