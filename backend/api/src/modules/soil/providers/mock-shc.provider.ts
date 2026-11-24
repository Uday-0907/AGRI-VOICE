import { ISHCProvider, SHCLookupResult } from './shc-provider.interface.js';

/**
 * Mock / Demo Soil Health Card Provider Adapter.
 * Provides realistic agronomic sample data for local test fixtures and demonstration workflows.
 *
 * Invariant: Every report returned is explicitly stamped with `isDemo: true`,
 * `source: 'demo_mock_provider'`, and `status: 'demo'`.
 */
export class MockSHCProvider implements ISHCProvider {
  readonly name = 'demo_mock_provider';

  async lookupCard(cardId: string): Promise<SHCLookupResult> {
    const normalized = cardId.trim().toUpperCase();

    if (normalized.startsWith('NOTFOUND') || normalized.startsWith('404')) {
      return {
        status: 'not_found',
        cardId,
        reportId: `DEMO-${cardId}-NOTFOUND`,
        source: this.name,
        sourceAuthority: 'AgriVoice Demo Soil Testing Laboratory',
        reportDate: new Date().toISOString(),
        isDemo: true,
        error: `Sample demo card ${cardId} not found.`,
      };
    }

    if (normalized.startsWith('UNAVAIL') || normalized.startsWith('503')) {
      return {
        status: 'provider_unavailable',
        cardId,
        reportId: `DEMO-${cardId}-UNAVAIL`,
        source: this.name,
        sourceAuthority: 'AgriVoice Demo Soil Testing Laboratory',
        reportDate: new Date().toISOString(),
        isDemo: true,
        error: 'Demo soil testing provider is temporarily offline for maintenance.',
      };
    }

    if (normalized.startsWith('FAIL') || normalized.startsWith('500')) {
      return {
        status: 'failed',
        cardId,
        reportId: `DEMO-${cardId}-FAIL`,
        source: this.name,
        sourceAuthority: 'AgriVoice Demo Soil Testing Laboratory',
        reportDate: new Date().toISOString(),
        isDemo: true,
        error: 'Simulated upstream lab report extraction failure.',
      };
    }

    // Default: Realistic Telangana / Andhra Pradesh Black Cotton Soil test result
    return {
      status: 'demo',
      cardId,
      reportId: `DEMO-SHC-${cardId}`,
      source: this.name,
      sourceAuthority: 'Regional Agricultural Research Station (Demo), ANGRAU',
      sampleDate: '2026-05-10T04:30:00.000Z',
      testingDate: '2026-05-18T10:00:00.000Z',
      reportDate: '2026-05-22T08:00:00.000Z',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      mandal: 'Tenali',
      village: 'Kollipara',
      soilType: 'black_cotton',

      // Verified range chemical readings
      ph: 7.65,
      ec: 0.420,
      organicCarbon: 0.54, // %
      nitrogen: 185.00, // kg/ha (Low)
      phosphorus: 24.50, // kg/ha (Medium)
      potassium: 340.00, // kg/ha (High)
      sulphur: 12.80, // ppm
      zinc: 0.58, // ppm (Deficient)
      iron: 6.20, // ppm (Sufficient)
      copper: 1.10, // ppm
      manganese: 4.80, // ppm
      boron: 0.45, // ppm (Low)

      nutrientRatings: {
        ph: 'SLIGHTLY_ALKALINE',
        organicCarbon: 'MEDIUM',
        nitrogen: 'LOW',
        phosphorus: 'MEDIUM',
        potassium: 'HIGH',
        zinc: 'DEFICIENT',
        boron: 'LOW',
      },

      recommendations: [
        {
          crop: 'Paddy / Rice',
          fertilizer: 'Urea',
          dosageKgPerAcre: 45,
          note: 'Apply in 3 splits (basal, tillering, panicle initiation)',
        },
        {
          crop: 'Paddy / Rice',
          fertilizer: 'Zinc Sulphate (21%)',
          dosageKgPerAcre: 10,
          note: 'Apply as basal dose to correct zinc deficiency',
        },
      ],

      isDemo: true,
    };
  }
}
