import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { changeAppLanguage, i18nReady } from '../app/providers/i18n';
import { isValidE164Phone, normalizeIndianPhone } from '../services/authService';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AgriVoice Full Integrated Application Workflows', () => {
  beforeEach(async () => {
    await i18nReady;
    await changeAppLanguage('en');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders landing page, supports mobile menu toggle, and switches languages with RTL', async () => {
    render(<App initialRoute="/" />);

    expect(screen.getByText(/Better farming decisions/i)).toBeInTheDocument();
    expect(screen.getByText('Weather & Crop Advisory', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Soil Health & Input Verification', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('AI Voice Assistance', { selector: 'h3' })).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const langSelect = screen.getByLabelText(/Select application language/i);
    fireEvent.change(langSelect, { target: { value: 'ur' } });
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
    });
  });

  it('prevents unauthenticated Voice queries from silently creating a demo session', async () => {
    render(<App initialRoute="/voice" />);

    const input = screen.getByLabelText(/Ask a question or speak using the microphone/i);
    fireEvent.change(input, { target: { value: 'What is today weather?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask AgriVoice/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Please sign in or explicitly start Demo Preview/i)
      ).toBeInTheDocument();
    });
  });

  it('completes live JWT flow: Landing -> Login (/auth/me) -> Dashboard -> Verified Weather -> Soil -> Voice -> Logout', async () => {
    expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
    expect(isValidE164Phone('+919876543210')).toBe(true);
    expect(isValidE164Phone('12345')).toBe(false);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      expect(auth).toBe('Bearer valid-backend-jwt-token');

      if (url.endsWith('/auth/me')) {
        return jsonResponse({
          data: {
            user: { id: 'u-1', phone: '+919876543201', status: 'active' },
            farmerProfile: {
              id: 'fp-1',
              userId: 'u-1',
              fullName: 'Ramesh Reddy',
              preferredLanguage: 'te',
              state: 'Andhra Pradesh',
              district: 'Guntur',
              mandal: 'Tenali',
              village: 'Kollipara',
              pinCode: '522201',
              status: 'active',
            },
            farms: [
              {
                id: 'farm-1',
                farmName: 'Live Guntur Farm',
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
                farmName: 'Tenali Canal Farm',
                totalAreaAcres: '3.00',
                ownershipType: 'owned',
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
        });
      }

      if (url.endsWith('/weather/dashboard')) {
        return jsonResponse({
          data: {
            farmId: 'farm-1',
            farmName: 'Live Guntur Farm',
            currentWeather: { temperature: 30.5, humidity: 62, rainfall: 0, windSpeed: 10, dataStatus: 'LIVE' },
            todayForecast: { high: 33, low: 24, rainfallProb: 10 },
            advisories: [],
            lastUpdated: new Date().toISOString(),
          },
        });
      }

      if (url.endsWith('/weather/farms/farm-1/current')) {
        return jsonResponse({
          data: {
            id: 'obs-1',
            locationId: 'farm-1',
            locationType: 'farm',
            dataStatus: 'LIVE',
            provider: 'open-meteo',
            observedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            temperature: 30.5,
            temperatureMin: null,
            temperatureMax: null,
            humidity: 62,
            windSpeed: 10,
            windDirection: 'E',
            windGusts: 14,
            pressure: 1012,
            cloudCover: 20,
            rainfall: 0,
            rainfallProbability: null,
            weatherCode: 1,
            weatherDescription: 'Mainly clear',
            farmName: 'Live Guntur Farm',
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
            observedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            temperature: 27.8,
            temperatureMin: null,
            temperatureMax: null,
            humidity: 70,
            windSpeed: 9,
            windDirection: 'NE',
            windGusts: 12,
            pressure: 1013,
            cloudCover: 35,
            rainfall: 1.2,
            rainfallProbability: null,
            weatherCode: 2,
            weatherDescription: 'Partly cloudy',
            farmName: 'Tenali Canal Farm',
          },
        });
      }

      if (url.includes('/weather/fields/field-1/forecast') || url.includes('/weather/fields/field-2/forecast')) {
        const isSecond = url.includes('field-2');
        return jsonResponse({
          data: {
            fieldId: isSecond ? 'field-2' : 'field-1',
            fieldName: isSecond ? 'South Cotton Plot' : 'North Paddy Plot',
            forecast: [
              {
                id: 'fc-1',
                locationId: isSecond ? 'field-2' : 'field-1',
                locationType: 'field',
                dataStatus: 'LIVE',
                provider: 'open-meteo',
                forecastType: 'daily',
                issueAt: new Date().toISOString(),
                validAt: new Date().toISOString(),
                temperatureMin: isSecond ? 21 : 23,
                temperatureMax: isSecond ? 29 : 32,
                humidity: 64,
                rainfall: 0,
                rainfallProbability: 20,
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

      if (url.includes('/weather/advisory/farms/')) {
        return jsonResponse({
          data: {
            farmId: url.includes('farm-2') ? 'farm-2' : 'farm-1',
            farmName: url.includes('farm-2') ? 'Tenali Canal Farm' : 'Live Guntur Farm',
            advisories: [
              {
                id: 'adv-1',
                category: 'irrigation',
                severity: 'warning',
                advisoryText: 'Irrigate early morning to reduce evaporation.',
                validFrom: new Date().toISOString(),
                validTo: null,
                evidenceSource: 'ICAR Rice Advisory',
                evidenceStrength: 'verified',
                verificationStatus: 'requires_review',
                generatedAt: new Date().toISOString(),
              },
            ],
          },
        });
      }

      if (url.endsWith('/weather/alerts')) {
        return jsonResponse({ data: { alerts: [] } });
      }

      if (url.endsWith('/weather/refresh')) {
        return jsonResponse({
          data: { status: 'refreshed', forced: true, message: 'Weather data fetched directly from provider (cache bypassed)' },
        });
      }

      if (url.endsWith('/soil/dashboard')) {
        return jsonResponse({
          data: {
            hasReport: true,
            latestReport: {
              id: 'rep-1',
              farmerId: 'fp-1',
              cardId: 'SHC-AP-1001',
              reportId: 'SHC-AP-1001',
              source: 'demo_shc_provider',
              reportDate: new Date().toISOString(),
              ph: 7.4,
              nitrogen: 185,
              boron: null,
              status: 'available',
              isDemo: 'false',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            summary: {
              totalReports: 1,
              lastTestedDate: new Date().toISOString(),
              primarySoilType: 'black_cotton',
              overallStatus: 'available',
              availableNutrientCount: 10,
              criticalDeficiencies: ['nitrogen'],
            },
            recentReports: [],
          },
        });
      }

      if (url.startsWith('http://localhost:4000/soil/reports')) {
        return jsonResponse({ data: [], meta: { pagination: { total: 0 } } });
      }

      if (url.startsWith('http://localhost:4000/soil/inputs/verifications')) {
        return jsonResponse({ data: [], meta: { pagination: { total: 0 } } });
      }

      if (url.endsWith('/soil/inputs/verify')) {
        return jsonResponse(
          {
            data: {
              id: 'ver-1',
              farmerId: 'fp-1',
              productName: 'DemoBio Complex NPK 20-20-20',
              category: 'fertilizer',
              batchNumber: 'DEMO-FERT-NPK-001',
              verificationStatus: 'demo',
              provider: 'demo_input_registry',
              evidence: {
                isDemo: true,
                officialNotice: 'DEMONSTRATION SAMPLE ONLY: Fictional reference formulation.',
              },
              notes: 'Demo note',
              createdAt: new Date().toISOString(),
            },
          },
          201
        );
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);

    // 1. Start at Landing -> navigate to Login
    render(<App initialRoute="/" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Farmer Login/i })[0]);

    // 2. Connect with Backend JWT (verified via GET /auth/me)
    fireEvent.click(screen.getByRole('button', { name: /Have a Backend Dev JWT Token/i }));
    fireEvent.change(screen.getByLabelText(/Bearer JWT Token/i), {
      target: { value: 'valid-backend-jwt-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Connect with JWT Token/i }));

    // 3. Authenticated Dashboard
    await waitFor(() => {
      expect(screen.getAllByText('Live Guntur Farm').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('30.5°C')).toBeInTheDocument();
    });

    // 4. Navigate to Weather -> Verified Pillar 3 WeatherDashboard renders inside Common UI
    fireEvent.click(screen.getByRole('button', { name: 'Weather & Crop Advisory' }));
    await waitFor(() => {
      expect(screen.getByText(/7-Day Field Forecast — North Paddy Plot/i)).toBeInTheDocument();
      expect(screen.getByText('Requires Review (Unverified)')).toBeInTheDocument();
    });

    // 5. Switch farm inside Weather -> updates current weather & forecast
    fireEvent.change(screen.getByLabelText('Selected Farm'), { target: { value: 'farm-2' } });
    await waitFor(() => {
      expect(screen.getByText('27.8°C')).toBeInTheDocument();
      expect(screen.getByText(/7-Day Field Forecast — South Cotton Plot/i)).toBeInTheDocument();
    });

    // 6. Refresh weather
    fireEvent.click(screen.getByRole('button', { name: /Refresh Weather/i }));
    await waitFor(() => {
      expect(screen.getByText(/Weather data fetched directly from provider/i)).toBeInTheDocument();
    });

    // 7. Navigate to Soil -> Verify object evidence renders safely without crashing React
    fireEvent.click(screen.getByRole('button', { name: 'Soil Health' }));
    await waitFor(() => {
      expect(screen.getByText(/SHC-AP-1001/)).toBeInTheDocument();
      expect(screen.getByText('185 kg/ha')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: /Input Verification/i }));
    fireEvent.change(screen.getByLabelText(/Product Name/i), {
      target: { value: 'DemoBio Complex NPK 20-20-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify Product/i }));
    await waitFor(() => {
      expect(screen.getByText(/DEMONSTRATION SAMPLE ONLY: Fictional reference formulation/i)).toBeInTheDocument();
    });

    // 8. Logout clears session
    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));
    await waitFor(() => {
      expect(window.localStorage.getItem('agrivoice_auth_session')).toBeNull();
      expect(screen.getByText(/Better farming decisions/i)).toBeInTheDocument();
    });
  });
});
