export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    isNetworkError = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : 'http://localhost:4000';
  return base.replace(/\/+$/, '');
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: BodyInit | object | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, body, method = 'GET', ...rest } = options;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const mergedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
      serializedBody = body;
      if (typeof body === 'string' && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }
    } else {
      serializedBody = JSON.stringify(body);
      if (!mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      method,
      headers: mergedHeaders,
      body: serializedBody,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      'Unable to reach the AgriVoice backend API. Verify the API server is running and reachable.',
      0,
      'NETWORK_ERROR',
      true
    );
  }

  const contentType = response.headers.get('content-type') || '';
  let parsed: any = null;
  if (contentType.includes('application/json')) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const nestedError = parsed?.error;
    const message =
      (typeof nestedError === 'object' && nestedError?.message) ||
      (typeof parsed?.message === 'string' && parsed.message) ||
      `Request failed with HTTP ${response.status}`;
    const code =
      (typeof nestedError === 'object' && nestedError?.code) ||
      (typeof parsed?.error === 'string' && parsed.error) ||
      `HTTP_${response.status}`;

    throw new ApiError(message, response.status, code, false);
  }

  return parsed as T;
}
