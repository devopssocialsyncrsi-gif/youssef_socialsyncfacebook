export type Platform = 'linkedin' | 'facebook' | 'instagram' | 'youtube';
export type TargetStatus = 'pending' | 'processing' | 'published' | 'failed';
export interface Target { id: string; platform: Platform; status: TargetStatus; attempts: number; external_id: string | null; external_url: string | null; error: string | null; updated_at: string }
export interface Post { id: string; title: string; caption: string; media_id: string; status: TargetStatus; created_at: string; updated_at: string; targets: Target[] }
export interface Media { id: string; original_name: string; mime_type: string; size_bytes: number; converted: boolean; publish_mime_type: string; created_at: string }

const TOKEN_KEY = 'socialsync_token';
export const getToken = () => typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => { if (token) window.localStorage.setItem(TOKEN_KEY, token); else window.localStorage.removeItem(TOKEN_KEY); };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('X-Request-ID', typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = typeof data.detail === 'string' ? data.detail : message; } catch { /* use status */ }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) => request<{access_token: string}>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  upload: (file: File) => { const form = new FormData(); form.append('file', file); return request<Media>('/media', { method: 'POST', body: form }); },
  deleteMedia: (id: string) => request<void>(`/media/${id}`, { method: 'DELETE' }),
  posts: () => request<Post[]>('/posts'),
  createPost: (title: string, caption: string, media_id: string, platforms: Platform[]) => request<Post>('/posts', { method: 'POST', body: JSON.stringify({ title, caption, media_id, platforms }) }),
  retry: (id: string, platform: Platform) => request<Post>(`/posts/${id}/targets/${platform}/retry`, { method: 'POST' }),
};
