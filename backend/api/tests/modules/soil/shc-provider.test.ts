import { describe, it, expect } from 'vitest';
import { GovernmentSHCProvider } from '../../../src/modules/soil/providers/gov-shc.provider.js';
import { MockSHCProvider } from '../../../src/modules/soil/providers/mock-shc.provider.js';

describe('Soil Health Card Provider Adapters', () => {
  describe('GovernmentSHCProvider', () => {
    it('should return provider_unavailable when API key is missing or placeholder', async () => {
      const provider = new GovernmentSHCProvider();
      const result = await provider.lookupCard('AP-GNT-109283');

      expect(result.status).toBe('provider_unavailable');
      expect(result.cardId).toBe('AP-GNT-109283');
      expect(result.isDemo).toBe(false);
      expect(result.error).toContain('Government Soil Health Card API credentials');
    });
  });

  describe('MockSHCProvider (Demo Mode)', () => {
    const provider = new MockSHCProvider();

    it('should return realistic agronomic data labeled as DEMO', async () => {
      const result = await provider.lookupCard('SHC-AP-2026-99');

      expect(result.status).toBe('demo');
      expect(result.isDemo).toBe(true);
      expect(result.source).toBe('demo_mock_provider');
      expect(result.state).toBe('Andhra Pradesh');
      expect(result.soilType).toBe('black_cotton');

      // Valid nutrient measurements
      expect(result.ph).toBe(7.65);
      expect(result.organicCarbon).toBe(0.54);
      expect(result.nitrogen).toBe(185.0);
      expect(result.zinc).toBe(0.58);

      // Deficiencies & ratings
      expect(result.nutrientRatings).toBeDefined();
      expect(result.nutrientRatings?.nitrogen).toBe('LOW');
      expect(result.nutrientRatings?.zinc).toBe('DEFICIENT');

      // Official source recommendations
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations?.length).toBeGreaterThan(0);
      expect(result.recommendations?.[0].fertilizer).toBe('Urea');
    });

    it('should return not_found when cardId starts with NOTFOUND', async () => {
      const result = await provider.lookupCard('NOTFOUND-12345');
      expect(result.status).toBe('not_found');
      expect(result.error).toContain('not found');
      expect(result.isDemo).toBe(true);
    });

    it('should return provider_unavailable when cardId starts with UNAVAIL', async () => {
      const result = await provider.lookupCard('UNAVAIL-999');
      expect(result.status).toBe('provider_unavailable');
      expect(result.error).toContain('offline for maintenance');
    });

    it('should return failed when cardId starts with FAIL', async () => {
      const result = await provider.lookupCard('FAIL-001');
      expect(result.status).toBe('failed');
      expect(result.error).toContain('extraction failure');
    });
  });
});
