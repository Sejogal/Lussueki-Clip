import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_STORAGE_KEY = '@lk-clip/auth-session';
const rawApiUrl = process.env.EXPO_PUBLIC_LK_CLIP_API_URL?.trim();
const API_URL = rawApiUrl?.replace(/\/$/, '');

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  plan?: 'free' | 'premium' | 'super_premium';
  login_count: number;
  last_login_at: string | null;
  created_at: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
};

export type WatchPayload = {
  title: string;
  category?: string;
  source_url: string;
  content_key: string;
  position_seconds?: number;
  duration_seconds?: number | null;
  count_view?: boolean;
};

export type HistoryItem = WatchPayload & {
  id: number;
  view_count: number;
  last_watched_at: string;
};

export type FavoriteResponse = {
  content_key: string;
  title: string;
  category: string | null;
  source_url: string;
  poster_url: string | null;
  added_at: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error(
      'Configure EXPO_PUBLIC_LK_CLIP_API_URL com o endereço do backend antes de entrar na conta.'
    );
  }
  return API_URL;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Não foi possível contactar o backend.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === 'string' ? body.detail : 'Não foi possível concluir a operação.';
    throw new ApiError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

async function authenticatedRequest<T>(accessToken: string, path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
}

async function persistSession(session: AuthSession): Promise<AuthSession> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return persistSession({ accessToken: response.access_token, user: response.user });
}

export async function signUp(name: string, email: string, password: string): Promise<AuthSession> {
  await request<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return signIn(email, password);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function registerWatch(accessToken: string, payload: WatchPayload): Promise<void> {
  await authenticatedRequest(accessToken, '/users/me/history', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getHistory(accessToken: string): Promise<HistoryItem[]> {
  return authenticatedRequest<HistoryItem[]>(accessToken, '/users/me/continue-watching');
}

export async function getFavorites(accessToken: string): Promise<FavoriteResponse[]> {
  return authenticatedRequest<FavoriteResponse[]>(accessToken, '/users/me/favorites');
}

export async function addFavorite(accessToken: string, payload: Record<string, string | undefined>): Promise<FavoriteResponse> {
  return authenticatedRequest<FavoriteResponse>(accessToken, '/users/me/favorites', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeFavorite(accessToken: string, contentKey: string): Promise<void> {
  await authenticatedRequest<void>(accessToken, `/users/me/favorites/${encodeURIComponent(contentKey)}`, {
    method: 'DELETE',
  });
}
