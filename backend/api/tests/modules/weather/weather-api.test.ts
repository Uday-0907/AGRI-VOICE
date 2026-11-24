/**
 * Weather API Integration Tests
 *
 * Tests Fastify HTTP routes for Pillar 3 — Weather & Crop Advisory.
 * Uses buildApp() + app.inject() (no real HTTP). All DB / service calls are mocked.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import * as ownership from '../../../src/common/auth/ownership.js';
import { WeatherService } from '../../../src/modules/weather/services/weather.service.js';
import { AdvisoryService } from '../../../src/modules/weather/services/advisory.service.js';
import { NotFoundError } from '../../../src/common/errors/index.js';

// ─── Shared Fixtures (All IDs must be valid lowercase hex UUIDs) ─────────────

const mockFarmerProfile = {
  id: 'f1000000-0000-0000-0000-000000000001',
  userId: 'u1000000-0000-0000-0000-000000000001',
  fullName: 'Ravi Kumar',
  state: 'Andhra Pradesh',
  district: 'Krishna',
  mandal: 'Vijayawada',
  village: 'Moghalrajpuram',
  pinCode: '520010',
  preferredLanguage: 'te',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFarm = {
  id: 'f2000000-0000-0000-0000-000000000001',
  farmerId: mockFarmerProfile.id,
  farmName: 'Ravi Farm',
  location: 'POINT(80.6 16.5)',
  area: '5',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockField = {
  id: 'f3000000-0000-0000-0000-000000000001',
  farmId: mockFarm.id,
  fieldName: 'North Paddy Field',
  location: 'POINT(80.65 16.55)',
  area: '2.5',
};

const otherFarmId = 'f9000000-0000-0000-0000-000000000099';
const otherFieldId = 'f9000000-0000-0000-0000-000000000098';

const mockWeather = {
  id: 'b1000000-0000-0000-0000-000000000001',
  locationId: mockFarm.id,
  locationType: 'farm' as const,
  dataStatus: 'LIVE' as const,
  provider: 'open-meteo',
  observedAt: new Date(),
  fetchedAt: new Date(),
  temperature: 28.5,
  temperatureMin: null,
  temperatureMax: null,
  humidity: 72,
  windSpeed: 15.2,
  windDirection: 'E',
  windGusts: 22.0,
  pressure: 1012.3,
  cloudCover: 40,
  rainfall: 0.0,
  rainfallProbability: null,
  weatherCode: 2,
  weatherDescription: 'Partly cloudy',
};

const mockAdvisories = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    ruleId: 'r1000000-0000-0000-0000-000000000001',
    fieldId: mockField.id,
    farmId: mockFarm.id,
    farmerId: mockFarmerProfile.id,
    cropSeasonId: 's1000000-0000-0000-0000-000000000001',
    category: 'irrigation' as const,
    severity: 'warning' as const,
    advisoryText: 'High temperature — consider irrigation',
    validFrom: new Date(),
    validTo: new Date(Date.now() + 86400_000),
    weatherContext: { temperature: 35, humidity: 70, rainfall: 0, rainfallProbability: 10, forecastRainfall: 0 },
    evidenceSource: 'ICAR Guidelines',
    evidenceStrength: 'verified' as const,
    verificationStatus: 'generated' as const,
    generatedAt: new Date(),
  },
];

describe('Pillar 3: Weather & Crop Advisory HTTP APIs', () => {
  let app: FastifyInstance;
  let testToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    testToken = app.jwt.sign({ id: mockFarmerProfile.userId, phone: '+919876543210' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Guards', () => {
    // Canonical URLs: prefix /weather + route path (no double /weather/weather/...)
    const unauthenticatedRoutes = [
      { method: 'GET' as const,  url: '/weather/dashboard' },
      { method: 'GET' as const,  url: '/weather/alerts' },
      {
        method: 'POST' as const,
        url: '/weather/refresh',
        payload: {},
        headers: { 'content-type': 'application/json' },
      },
      { method: 'GET' as const,  url: `/weather/farms/${mockFarm.id}/current` },
      { method: 'GET' as const,  url: `/weather/fields/${mockField.id}/forecast` },
      { method: 'GET' as const,  url: `/weather/advisory/farms/${mockFarm.id}` },
    ];

    for (const { method, url, payload, headers } of unauthenticatedRoutes) {
      it(`${method} ${url} → 401 without auth token`, async () => {
        const response = await app.inject({ method, url, payload, headers });
        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.error?.code).toBe('UNAUTHORIZED');
      });
    }
  });

  describe('Canonical route registration', () => {
    it('registers canonical /weather paths only (no /weather/weather aliases)', () => {
      expect(app.printRoutes({ commonPrefix: false })).not.toContain('/weather/weather');

      expect(app.hasRoute({ method: 'GET', url: '/weather/dashboard' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/weather/farms/:farmId/current' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/weather/fields/:fieldId/forecast' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/weather/alerts' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/weather/advisory/farms/:farmId' })).toBe(true);
      expect(app.hasRoute({ method: 'POST', url: '/weather/refresh' })).toBe(true);

      expect(app.hasRoute({ method: 'GET', url: '/weather/weather/dashboard' })).toBe(false);
      expect(app.hasRoute({ method: 'GET', url: '/weather/advisories/farms/:farmId' })).toBe(false);
    });
  });

  describe('Dashboard Route', () => {
    it('GET /weather/dashboard → 200 with farm weather data', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockFarm]),
          }),
        }),
      } as any);

      vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValueOnce(mockWeather);
      vi.spyOn(WeatherService.prototype, 'getForecast').mockResolvedValueOnce([]);
      vi.spyOn(AdvisoryService.prototype, 'getAdvisories').mockResolvedValueOnce(mockAdvisories);

      const response = await app.inject({
        method: 'GET',
        url: '/weather/dashboard',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.farmId).toBe(mockFarm.id);
      expect(body.data.farmName).toBe(mockFarm.farmName);
      expect(body.data.advisories).toBeInstanceOf(Array);
    });

    it('GET /weather/dashboard → 404 when farmer has no farm', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/weather/dashboard',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error?.code).toBe('NO_FARM');
    });
  });

  describe('Farm Current Weather Route', () => {
    it('GET /weather/farms/:farmId/current → 200 for owned farm', async () => {
      vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
        farm: mockFarm as any,
        profile: mockFarmerProfile,
      });
      vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValueOnce(mockWeather);

      const response = await app.inject({
        method: 'GET',
        url: `/weather/farms/${mockFarm.id}/current`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.locationId).toBe(mockFarm.id);
      expect(body.data.dataStatus).toBe('LIVE');
    });

    it("GET /weather/farms/:farmId/current → 404 for another farmer's farm", async () => {
      vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
        new NotFoundError('Farm not found or access denied')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/weather/farms/${otherFarmId}/current`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Field Forecast Route', () => {
    it('GET /weather/fields/:fieldId/forecast → 200 for owned field', async () => {
      vi.spyOn(ownership, 'assertFieldOwnership').mockResolvedValue({
        field: mockField as any,
        farm: mockFarm as any,
        profile: mockFarmerProfile,
      });
      vi.spyOn(WeatherService.prototype, 'getForecast').mockResolvedValueOnce([]);

      const response = await app.inject({
        method: 'GET',
        url: `/weather/fields/${mockField.id}/forecast`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.forecast)).toBe(true);
    });

    it("GET /weather/fields/:fieldId/forecast → 404 for another farmer's field", async () => {
      vi.spyOn(ownership, 'assertFieldOwnership').mockRejectedValue(
        new NotFoundError('Field not found or access denied')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/weather/fields/${otherFieldId}/forecast`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Alerts Route', () => {
    it('GET /weather/alerts → 200 with alerts array', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFarm]),
        }),
      } as any);
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/weather/alerts',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data?.alerts).toBeInstanceOf(Array);
    });

    it('GET /weather/alerts → 200 with empty alerts when farmer has no farms', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/weather/alerts',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data?.alerts).toHaveLength(0);
    });
  });

  describe('Refresh Route', () => {
    it('POST /weather/refresh → 200 with status=refreshed, forced=false (no specific farmId)', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockFarm]),
          }),
        }),
      } as any);

      vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValueOnce(mockWeather);

      const response = await app.inject({
        method: 'POST',
        url: '/weather/refresh',
        headers: { authorization: `Bearer ${testToken}`, 'content-type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data?.status).toBe('refreshed');
      expect(body.data?.forced).toBe(false);
      // Message must NOT imply provider fetch when force=false (data may be cached)
      expect(body.data?.message).toContain('cache');
    });

    it('POST /weather/refresh with force=true → 200 with forced=true message', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);

      const { db } = await import('../../../src/database/db.js');
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockFarm]),
          }),
        }),
      } as any);

      vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValueOnce(mockWeather);

      const response = await app.inject({
        method: 'POST',
        url: '/weather/refresh',
        headers: { authorization: `Bearer ${testToken}`, 'content-type': 'application/json' },
        payload: { force: true },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data?.status).toBe('refreshed');
      expect(body.data?.forced).toBe(true);
      expect(body.data?.message).toContain('provider');
      // getCurrentWeather must have been called with forceRefresh=true
      expect(WeatherService.prototype.getCurrentWeather).toHaveBeenCalledWith(
        mockFarm.id, undefined, true
      );
    });

    it('POST /weather/refresh with owned farmId → 200', async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);
      vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
        farm: mockFarm as any,
        profile: mockFarmerProfile,
      });

      vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValueOnce(mockWeather);

      const response = await app.inject({
        method: 'POST',
        url: '/weather/refresh',
        headers: { authorization: `Bearer ${testToken}`, 'content-type': 'application/json' },
        payload: { farmId: mockFarm.id },
      });

      expect(response.statusCode).toBe(200);
    });

    it("POST /weather/refresh with another farmer's farmId → 404", async () => {
      vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);
      vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
        new NotFoundError('Farm not found or access denied')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/weather/refresh',
        headers: { authorization: `Bearer ${testToken}`, 'content-type': 'application/json' },
        payload: { farmId: otherFarmId },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Advisory Route', () => {
    it('GET /weather/advisory/farms/:farmId → 200 with advisories array', async () => {
      vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
        farm: mockFarm as any,
        profile: mockFarmerProfile,
      });
      vi.spyOn(AdvisoryService.prototype, 'generateAdvisories').mockResolvedValueOnce(mockAdvisories);

      const response = await app.inject({
        method: 'GET',
        url: `/weather/advisory/farms/${mockFarm.id}`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data?.advisories).toBeInstanceOf(Array);
      expect(body.data.advisories).toHaveLength(1);
      expect(body.data.advisories[0].category).toBe('irrigation');
      expect(body.data.advisories[0].severity).toBe('warning');
    });

    it("GET /weather/advisory/farms/:farmId → 404 for another farmer's farm", async () => {
      vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
        new NotFoundError('Farm not found or access denied')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/weather/advisory/farms/${otherFarmId}`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
