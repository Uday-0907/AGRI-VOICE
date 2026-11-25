import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { WeatherDashboardContent } from '../WeatherDashboard';

const mockMe = {
  data: {
    user: { id: 'u-1', phone: '+919900000001', status: 'active' },
    farmerProfile: {
      id: 'fp-1',
      userId: 'u-1',
      fullName: 'Ravi Kumar',
      preferredLanguage: 'te',
      state: 'Andhra Pradesh',
      district: 'Krishna',
      mandal: 'Vijayawada',
      village: 'Poranki',
      pinCode: '521137',
      status: 'active',
    },
    farms: [
      {
        id: 'farm-1',
        farmName: 'Vijayawada River Farm',
        totalAreaAcres: '4.50',
        ownershipType: 'owned',
        fields: [
          {
            id: 'field-1',
            farmId: 'farm-1',
            fieldName: 'North Paddy Plot',
            areaAcres: '2.00',
            soilType: 'alluvial',
            irrigationSource: 'canal',
          },
        ],
      },
      {
        id: 'farm-2',
        farmName: 'Guntur Upland Farm',
        totalAreaAcres: '3.00',
        ownershipType: 'leased',
        fields: [
          {
            id: 'field-2',
            farmId: 'farm-2',
            fieldName: 'South Cotton Plot',
            areaAcres: '3.00',
            soilType: 'black_cotton',
            irrigationSource: 'borewell',
          },
        ],
      },
    ],
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('WeatherDashboardContent (Phase 2 Verification)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps demo preview strictly separated from unauthenticated state', () => {
    render(
      <WeatherDashboardContent
        backendToken={null}
        authStatus="unauthenticated"
      />
    );

    expect(screen.getByText(/Sign in to access live farm weather/i)).toBeInTheDocument();
    expect(screen.queryByText(/28°C/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Preview Demo Data/i }));
    expect(screen.getByText(/DEVELOPMENT DEMO DATA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/28°C/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Exit Demo Preview/i }));
    expect(screen.getByText(/Sign in to access live farm weather/i)).toBeInTheDocument();
  });

  it('loads live farm data, switches farms, filters advisories, and refreshes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const authHeader = (init?.headers as Record<string, string>)?.Authorization;
      expect(authHeader).toBe('Bearer jwt-token-123');

      if (url.endsWith('/auth/me')) {
        return jsonResponse(mockMe);
      }
      if (url.endsWith('/weather/dashboard')) {
        return jsonResponse({
          data: {
            farmId: 'farm-1',
            farmName: 'Vijayawada River Farm',
            currentWeather: { temperature: 31.2, humidity: 68, rainfall: 0, windSpeed: 10, dataStatus: 'LIVE' },
            todayForecast: { high: 33, low: 24, rainfallProb: 15 },
            advisories: [],
            lastUpdated: '2026-11-25T05:00:00.000Z',
          },
        });
      }
      if (url.endsWith('/weather/alerts')) {
        return jsonResponse({ data: { alerts: [] } });
      }
      if (url.endsWith('/weather/farms/farm-1/current')) {
        return jsonResponse({
          data: {
            id: 'obs-1',
            locationId: 'farm-1',
            locationType: 'farm',
            dataStatus: 'LIVE',
            provider: 'open-meteo',
            observedAt: '2026-11-25T05:00:00.000Z',
            fetchedAt: '2026-11-25T05:00:00.000Z',
            temperature: 31.2,
            temperatureMin: null,
            temperatureMax: null,
            humidity: 68,
            windSpeed: 10,
            windDirection: 'E',
            windGusts: 14,
            pressure: 1012,
            cloudCover: 20,
            rainfall: 0,
            rainfallProbability: null,
            weatherCode: 1,
            weatherDescription: 'Mainly clear',
            farmName: 'Vijayawada River Farm',
          },
        });
      }
      if (url.endsWith('/weather/farms/farm-2/current')) {
        return jsonResponse({
          data: {
            id: 'obs-2',
            locationId: 'farm-2',
            locationType: 'farm',
            dataStatus: 'CACHED',
            provider: 'open-meteo',
            observedAt: '2026-11-25T04:45:00.000Z',
            fetchedAt: '2026-11-25T04:45:00.000Z',
            temperature: 26.7,
            temperatureMin: null,
            temperatureMax: null,
            humidity: 74,
            windSpeed: 8,
            windDirection: 'NE',
            windGusts: 12,
            pressure: 1013,
            cloudCover: 40,
            rainfall: 1.5,
            rainfallProbability: null,
            weatherCode: 2,
            weatherDescription: 'Partly cloudy',
            farmName: 'Guntur Upland Farm',
          },
        });
      }
      if (url.includes('/weather/fields/field-1/forecast')) {
        return jsonResponse({
          data: {
            fieldId: 'field-1',
            fieldName: 'North Paddy Plot',
            forecast: [
              {
                id: 'fc-1',
                locationId: 'field-1',
                locationType: 'field',
                dataStatus: 'LIVE',
                provider: 'open-meteo',
                forecastType: url.includes('type=hourly') ? 'hourly' : 'daily',
                issueAt: '2026-11-25T00:00:00.000Z',
                validAt: '2026-11-25T06:00:00.000Z',
                temperatureMin: 24,
                temperatureMax: 33,
                humidity: 65,
                rainfall: 0,
                rainfallProbability: 15,
                precipitationSum: 0,
                windSpeed: 10,
                windDirection: 'E',
                cloudCover: 20,
                weatherCode: 1,
                weatherDescription: 'Mainly clear',
                sunshineDuration: 420,
                uvIndex: 6,
              },
            ],
          },
        });
      }
      if (url.includes('/weather/fields/field-2/forecast')) {
        return jsonResponse({
          data: {
            fieldId: 'field-2',
            fieldName: 'South Cotton Plot',
            forecast: [
              {
                id: 'fc-2',
                locationId: 'field-2',
                locationType: 'field',
                dataStatus: 'LIVE',
                provider: 'open-meteo',
                forecastType: 'daily',
                issueAt: '2026-11-25T00:00:00.000Z',
                validAt: '2026-11-25T06:00:00.000Z',
                temperatureMin: 21,
                temperatureMax: 29,
                humidity: 72,
                rainfall: 2.0,
                rainfallProbability: 45,
                precipitationSum: 2.0,
                windSpeed: 9,
                windDirection: 'NE',
                cloudCover: 50,
                weatherCode: 61,
                weatherDescription: 'Slight rain',
                sunshineDuration: 240,
                uvIndex: 4,
              },
            ],
          },
        });
      }
      if (url.includes('/weather/advisory/farms/farm-1')) {
        return jsonResponse({
          data: {
            farmId: 'farm-1',
            farmName: 'Vijayawada River Farm',
            advisories: [
              {
                id: 'adv-1',
                category: 'irrigation',
                severity: 'warning',
                advisoryText: 'Schedule early morning paddy irrigation.',
                validFrom: '2026-11-25T00:00:00.000Z',
                validTo: null,
                evidenceSource: 'ICAR Guidelines',
                evidenceStrength: 'verified',
                verificationStatus: 'requires_review',
                generatedAt: '2026-11-25T05:00:00.000Z',
              },
            ],
          },
        });
      }
      if (url.includes('/weather/advisory/farms/farm-2')) {
        return jsonResponse({
          data: {
            farmId: 'farm-2',
            farmName: 'Guntur Upland Farm',
            advisories: [
              {
                id: 'adv-2',
                category: 'general',
                severity: 'info',
                advisoryText: 'Monitor cotton bolls after light rain.',
                validFrom: '2026-11-25T00:00:00.000Z',
                validTo: null,
                evidenceSource: 'State Bulletin',
                evidenceStrength: 'recommended',
                verificationStatus: 'generated',
                generatedAt: '2026-11-25T05:00:00.000Z',
              },
            ],
          },
        });
      }
      if (url.endsWith('/weather/refresh')) {
        return jsonResponse({
          data: {
            status: 'refreshed',
            forced: true,
            message: 'Weather data fetched directly from provider (cache bypassed)',
          },
        });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Unhandled' } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <WeatherDashboardContent
        backendToken="jwt-token-123"
        authStatus="authenticated"
      />
    );

    // Wait for Farm 1 weather, forecast, advisory, and empty alerts
    await waitFor(() => {
      expect(screen.getByText('31.2°C')).toBeInTheDocument();
      expect(screen.getByText(/7-Day Field Forecast — North Paddy Plot/i)).toBeInTheDocument();
      expect(screen.getByText(/Schedule early morning paddy irrigation/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Requires Review (Unverified)')).toBeInTheDocument();
    expect(screen.getByText('No active weather alerts')).toBeInTheDocument();

    // Switch farm to Farm 2 -> must update weather, forecast, and advisories
    fireEvent.change(screen.getByLabelText('Selected Farm'), { target: { value: 'farm-2' } });

    await waitFor(() => {
      expect(screen.getByText('26.7°C')).toBeInTheDocument();
      expect(screen.getByText(/7-Day Field Forecast — South Cotton Plot/i)).toBeInTheDocument();
      expect(screen.getByText(/Monitor cotton bolls after light rain/i)).toBeInTheDocument();
    });
    expect(screen.getByText('System-Generated (Unverified)')).toBeInTheDocument();
    expect(screen.getByText('CACHED')).toBeInTheDocument();

    // Filter advisory category
    fireEvent.change(screen.getByLabelText('Category Filter'), { target: { value: 'irrigation' } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/weather/advisory/farms/farm-2?category=irrigation'),
        expect.any(Object)
      );
    });

    // Click Refresh Weather
    fireEvent.click(screen.getByRole('button', { name: /Refresh Weather/i }));
    await waitFor(() => {
      expect(screen.getByText(/Weather data fetched directly from provider/i)).toBeInTheDocument();
    });
  });

  it('handles network failures and 401/404 honestly without falling back to demo data', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.endsWith('/weather/dashboard')) {
          return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
        }
        throw new TypeError('Failed to fetch');
      })
    );

    render(
      <WeatherDashboardContent
        backendToken="expired-token"
        authStatus="authenticated"
        onUnauthorized={onUnauthorized}
      />
    );

    await waitFor(() => {
      expect(onUnauthorized).toHaveBeenCalled();
    });
    expect(screen.queryByText(/28°C/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sample Location/)).not.toBeInTheDocument();
  });

  it('shows honest error banner when backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    render(
      <WeatherDashboardContent
        backendToken="jwt-token-123"
        authStatus="authenticated"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/NETWORK_ERROR:/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/28°C/)).not.toBeInTheDocument();
  });
});
