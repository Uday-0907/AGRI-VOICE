import { apiRequest } from './apiClient';
import type {
  AdvisoryCategory,
  AuthContextData,
  AuthExchangeData,
  FarmAdvisoriesData,
  FarmCurrentWeatherData,
  FieldForecastData,
  WeatherAlertsData,
  WeatherDashboardData,
  WeatherRefreshData,
} from '@/types/weather';

export async function exchangeClerkToken(clerkToken: string): Promise<AuthExchangeData> {
  const res = await apiRequest<{ data: AuthExchangeData }>('/auth/clerk/exchange', {
    method: 'POST',
    token: clerkToken,
  });
  return res.data;
}

export async function getAuthMe(token: string, signal?: AbortSignal): Promise<AuthContextData> {
  const res = await apiRequest<{ data: AuthContextData }>('/auth/me', { token, signal });
  return res.data;
}

export async function getWeatherDashboard(
  token: string,
  signal?: AbortSignal
): Promise<WeatherDashboardData> {
  const res = await apiRequest<{ data: WeatherDashboardData }>('/weather/dashboard', {
    token,
    signal,
  });
  return res.data;
}

export async function getFarmCurrentWeather(
  token: string,
  farmId: string,
  signal?: AbortSignal
): Promise<FarmCurrentWeatherData> {
  const res = await apiRequest<{ data: FarmCurrentWeatherData }>(
    `/weather/farms/${encodeURIComponent(farmId)}/current`,
    { token, signal }
  );
  return res.data;
}

export async function getFieldForecast(
  token: string,
  fieldId: string,
  params: { days?: number; type?: 'daily' | 'hourly' } = {},
  signal?: AbortSignal
): Promise<FieldForecastData> {
  const search = new URLSearchParams();
  if (params.days !== undefined) search.set('days', String(params.days));
  if (params.type !== undefined) search.set('type', params.type);
  const query = search.toString();
  const suffix = query ? `?${query}` : '';
  const res = await apiRequest<{ data: FieldForecastData }>(
    `/weather/fields/${encodeURIComponent(fieldId)}/forecast${suffix}`,
    { token, signal }
  );
  return res.data;
}

export async function getWeatherAlerts(
  token: string,
  signal?: AbortSignal
): Promise<WeatherAlertsData> {
  const res = await apiRequest<{ data: WeatherAlertsData }>('/weather/alerts', {
    token,
    signal,
  });
  return res.data;
}

export async function getFarmAdvisories(
  token: string,
  farmId: string,
  category?: AdvisoryCategory,
  signal?: AbortSignal
): Promise<FarmAdvisoriesData> {
  const suffix = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await apiRequest<{ data: FarmAdvisoriesData }>(
    `/weather/advisory/farms/${encodeURIComponent(farmId)}${suffix}`,
    { token, signal }
  );
  return res.data;
}

export async function refreshWeather(
  token: string,
  payload: { farmId?: string; force?: boolean } = {}
): Promise<WeatherRefreshData> {
  const res = await apiRequest<{ data: WeatherRefreshData }>('/weather/refresh', {
    method: 'POST',
    token,
    body: payload,
  });
  return res.data;
}
