const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessTokenProvider: () => string | null = () => null;

export function setAccessTokenProvider(fn: () => string | null): void {
  accessTokenProvider = fn;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export interface UploadOptions {
  method?: string;
  formData: FormData;
  auth?: boolean;
}

export async function apiUpload<T>(path: string, options: UploadOptions): Promise<T> {
  const { method = 'POST', formData, auth = true } = options;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = accessTokenProvider();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  // No Content-Type header: the browser sets the multipart boundary for FormData.
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: formData,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, 'Upload failed'));
  }

  return payload as T;
}

/**
 * Fetches a file and hands it to the browser as a download.
 *
 * A plain <a href> can't be used for these: the CSV routes sit behind
 * RolesGuard and need the Authorization header, which a navigation request
 * won't carry.
 */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = accessTokenProvider();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;
    throw new ApiError(response.status, extractMessage(payload, 'Download failed'));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click so the browser has already taken the data.
  URL.revokeObjectURL(url);
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = accessTokenProvider();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, 'Request failed'));
  }

  return payload as T;
}
