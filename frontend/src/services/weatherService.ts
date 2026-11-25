import { apiRequest } from './apiClient';
import {
  DEMO_ADVISORIES,
  DEMO_DAILY_FORECAST,
  DEMO_HOURLY_FORECAST,
  DEMO_WEATHER_ALERTS,
  DEMO_WEATHER_DASHBOARD,
} from './demoData';
import type {
  AdvisoryCategory,
  AuthSession,
  WeatherAdvisoryItem,
  WeatherAlertItem,
  WeatherDashboardData,
  WeatherForecastItem,
} from '../types/api';

export async function fetchWeatherDashboard(
  session: AuthSession
): Promise<WeatherDashboardData> {
  if (session.mode === 'demo') {
    return DEMO_WEATHER_DASHBOARD;
  }
  const res = await apiRequest<{ data: WeatherDashboardData }>('/weather/dashboard', {
    token: session.token,
  });
  return res.data;
}

export async function fetchFarmCurrentWeather(
  session: AuthSession,
  farmId: string
): Promise<{
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  windSpeed: number | null;
  dataStatus?: string;
  farmName?: string;
}> {
  if (session.mode === 'demo') {
    return {
      ...DEMO_WEATHER_DASHBOARD.currentWeather,
      farmName: DEMO_WEATHER_DASHBOARD.farmName,
    };
  }
  const res = await apiRequest<{
    data: {
      temperature: number | null;
      humidity: number | null;
      rainfall: number | null;
      windSpeed: number | null;
      dataStatus?: string;
      farmName?: string;
    };
  }>(`/weather/farms/${farmId}/current`, {
    token: session.token,
  });
  return res.data;
}

export async function fetchFieldForecast(
  session: AuthSession,
  fieldId: string,
  type: 'daily' | 'hourly',
  days: number
): Promise<{ fieldId: string; fieldName: string; forecast: WeatherForecastItem[] }> {
  if (session.mode === 'demo') {
    return {
      fieldId,
      fieldName: session.farms[0]?.fieldName ?? 'North Plot',
      forecast: type === 'hourly' ? DEMO_HOURLY_FORECAST : DEMO_DAILY_FORECAST.slice(0, days),
    };
  }

  const clampedDays = type === 'hourly' ? Math.min(days, 2) : Math.min(days, 14);
  const res = await apiRequest<{
    data: { fieldId: string; fieldName: string; forecast: WeatherForecastItem[] };
  }>(`/weather/fields/${fieldId}/forecast?days=${clampedDays}&type=${type}`, {
    token: session.token,
  });
  return res.data;
}

export async function fetchWeatherAlerts(
  session: AuthSession
): Promise<WeatherAlertItem[]> {
  if (session.mode === 'demo') {
    return DEMO_WEATHER_ALERTS;
  }
  const res = await apiRequest<{ data: { alerts: WeatherAlertItem[] } }>('/weather/alerts', {
    token: session.token,
  });
  return res.data.alerts;
}

export async function fetchFarmAdvisories(
  session: AuthSession,
  farmId: string,
  category?: AdvisoryCategory | 'all'
): Promise<{ farmId: string; farmName: string; advisories: WeatherAdvisoryItem[] }> {
  if (session.mode === 'demo') {
    const filtered =
      category && category !== 'all'
        ? DEMO_ADVISORIES.filter((a) => a.category === category)
        : DEMO_ADVISORIES;
    return {
      farmId,
      farmName: DEMO_WEATHER_DASHBOARD.farmName,
      advisories: filtered,
    };
  }

  const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  const res = await apiRequest<{
    data: { farmId: string; farmName: string; advisories: WeatherAdvisoryItem[] };
  }>(`/weather/advisory/farms/${farmId}${query}`, {
    token: session.token,
  });
  return res.data;
}

export async function refreshWeatherData(
  session: AuthSession,
  farmId?: string,
  force = true
): Promise<{ status: string; forced: boolean; message: string }> {
  if (session.mode === 'demo') {
    return {
      status: 'refreshed',
      forced: force,
      message: 'Demo weather preview refreshed.',
    };
  }

  const res = await apiRequest<{
    data: { status: string; forced: boolean; message: string };
  }>('/weather/refresh', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ farmId, force }),
  });
  return res.data;
}
