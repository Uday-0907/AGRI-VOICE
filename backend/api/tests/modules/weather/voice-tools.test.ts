/**
 * Voice Tools Tests
 *
 * Tests the Weather module voice tools: registration, ownership enforcement,
 * and output format for each tool.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWeatherVoiceTools } from '../../../src/modules/weather/voice-tools.js';
import * as ownership from '../../../src/common/auth/ownership.js';
import { WeatherService } from '../../../src/modules/weather/services/weather.service.js';
import { AdvisoryService } from '../../../src/modules/weather/services/advisory.service.js';
import { NotFoundError } from '../../../src/common/errors/index.js';
import type { VoiceSessionContext } from '../../../src/modules/voice/dispatcher.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

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

const mockSession: VoiceSessionContext = {
  userId: mockFarmerProfile.userId,
  sessionId: 'sess-001',
  phone: '+919876543210',
};

const mockWeather = {
  id: 'obs-001',
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
  rainfall: 0.5,
  rainfallProbability: 10,
  weatherCode: 2,
  weatherDescription: 'Partly cloudy',
};

// ─── Tool registration ────────────────────────────────────────────────────────

describe('createWeatherVoiceTools() — registration', () => {
  it('registers exactly 4 tools', () => {
    const tools = createWeatherVoiceTools();
    expect(tools).toHaveLength(4);
  });

  it('registers tools with the correct names', () => {
    const tools = createWeatherVoiceTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('getCurrentWeather');
    expect(names).toContain('getWeatherForecast');
    expect(names).toContain('getCropAdvisory');
    expect(names).toContain('getWeatherAlerts');
  });

  it('each tool has parameters.type === "object"', () => {
    const tools = createWeatherVoiceTools();
    for (const tool of tools) {
      expect(tool.parameters.type).toBe('object');
    }
  });

  it('each tool requires farmId as a parameter', () => {
    const tools = createWeatherVoiceTools();
    for (const tool of tools) {
      expect(tool.parameters.required).toContain('farmId');
    }
  });
});

// ─── getCurrentWeather tool ───────────────────────────────────────────────────

describe('Voice tool — getCurrentWeather', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns structured weather with farm name and data status', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });
    vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValue(mockWeather);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCurrentWeather')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id });

    expect(result.farmName).toBe('Ravi Farm');
    expect(result.temperature).toBe('28.5°C');
    expect(result.humidity).toBe('72%');
    expect(result.rainfall).toBe('0.5mm');
    expect(result.dataStatus).toBe('LIVE');
  });

  it('shows "No rainfall" when rainfall is null/zero', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });
    vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValue({
      ...mockWeather,
      rainfall: null,
    });

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCurrentWeather')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id });

    expect(result.rainfall).toBe('No rainfall');
  });

  it('calls assertFarmOwnership with session.userId and args.farmId', async () => {
    const spy = vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });
    vi.spyOn(WeatherService.prototype, 'getCurrentWeather').mockResolvedValue(mockWeather);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCurrentWeather')!;

    await tool.execute(mockSession, { farmId: mockFarm.id });

    expect(spy).toHaveBeenCalledWith(mockSession.userId, mockFarm.id);
  });

  it('propagates NotFoundError when farm does not belong to farmer', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
      new NotFoundError('Farm not found or access denied')
    );

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCurrentWeather')!;

    await expect(tool.execute(mockSession, { farmId: 'other-farm' })).rejects.toThrow('Farm not found');
  });
});

// ─── getWeatherForecast tool ──────────────────────────────────────────────────

describe('Voice tool — getWeatherForecast', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns forecast array with date/high/low/rainfallProb', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });

    const tomorrow = new Date(Date.now() + 86400_000);
    vi.spyOn(WeatherService.prototype, 'getForecast').mockResolvedValue([
      {
        id: 'fcst-001',
        locationId: mockFarm.id,
        locationType: 'farm',
        dataStatus: 'LIVE',
        provider: 'open-meteo',
        forecastType: 'daily',
        issueAt: new Date(),
        validAt: tomorrow,
        temperatureMin: 22.0,
        temperatureMax: 33.0,
        humidity: 68,
        rainfall: 0.0,
        rainfallProbability: 5,
        precipitationSum: 0.0,
        windSpeed: 18.0,
        windDirection: 'E',
        cloudCover: 15,
        weatherCode: 0,
        weatherDescription: 'Clear sky',
        sunshineDuration: 28800,
        uvIndex: 7.0,
      },
    ]);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getWeatherForecast')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id, days: 1 });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe(tomorrow.toISOString().split('T')[0]);
    expect(result[0].high).toBe('33°C');
    expect(result[0].low).toBe('22°C');
    expect(result[0].rainfallProb).toBe('5%');
  });

  it('propagates ownership error', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
      new NotFoundError('Farm not found or access denied')
    );

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getWeatherForecast')!;

    await expect(tool.execute(mockSession, { farmId: 'other-farm' })).rejects.toThrow();
  });
});

// ─── getCropAdvisory tool ─────────────────────────────────────────────────────

describe('Voice tool — getCropAdvisory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns advisory array with category/severity/text/source', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });
    vi.spyOn(AdvisoryService.prototype, 'getAdvisories').mockResolvedValue([
      {
        id: 'adv-1',
        ruleId: 'rule-1',
        fieldId: 'field-1',
        farmId: mockFarm.id,
        farmerId: mockFarmerProfile.id,
        cropSeasonId: 'season-1',
        category: 'irrigation',
        severity: 'warning',
        advisoryText: 'Irrigate the field',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 86400_000),
        weatherContext: { temperature: 35, humidity: 70, rainfall: 0, rainfallProbability: 10, forecastRainfall: 0 },
        evidenceSource: 'ICAR',
        evidenceStrength: 'verified',
        verificationStatus: 'generated',
        generatedAt: new Date(),
      },
    ]);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCropAdvisory')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('irrigation');
    expect(result[0].severity).toBe('warning');
    expect(result[0].text).toBe('Irrigate the field');
    expect(result[0].source).toBe('ICAR');
  });

  it('returns empty array when no advisories', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });
    vi.spyOn(AdvisoryService.prototype, 'getAdvisories').mockResolvedValue([]);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getCropAdvisory')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id });
    expect(result).toHaveLength(0);
  });
});

// ─── getWeatherAlerts tool ────────────────────────────────────────────────────

describe('Voice tool — getWeatherAlerts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { alerts: [] } stub when no active alerts', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockResolvedValue({
      farm: mockFarm as any,
      profile: mockFarmerProfile,
    });

    const { db } = await import('../../../src/database/db.js');
    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getWeatherAlerts')!;

    const result = await tool.execute(mockSession, { farmId: mockFarm.id });

    expect(result).toHaveProperty('alerts');
    expect(result.alerts).toHaveLength(0);
  });

  it('propagates ownership error when farm does not belong to farmer', async () => {
    vi.spyOn(ownership, 'assertFarmOwnership').mockRejectedValue(
      new NotFoundError('Farm not found or access denied')
    );

    const tools = createWeatherVoiceTools();
    const tool = tools.find(t => t.name === 'getWeatherAlerts')!;

    await expect(tool.execute(mockSession, { farmId: 'other-farm' })).rejects.toThrow();
  });
});
