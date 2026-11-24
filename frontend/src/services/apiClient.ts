export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  if (configured && configured.trim() !== '') {
    return configured.replace(/\/+$/, '');
  }
  return 'http://localhost:4000';
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const mergedHeaders: Record<string, string> = {
    ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: mergedHeaders,
    });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      'NETWORK_ERROR'
    );
  }

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const errObj =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { message?: string; code?: string } }).error
        : undefined;
    throw new ApiError(
      errObj?.message || `HTTP ${response.status} ${response.statusText}`,
      response.status,
      errObj?.code
    );
  }

  return payload as T;
}
