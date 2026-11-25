import { ISHCProvider, SHCLookupResult } from './shc-provider.interface.js';

/**
 * Official Government Soil Health Card API Provider Adapter.
 * Interfaces with the national Soil Health Card portal (soilhealth.dac.gov.in) API gateway.
 *
 * Truthful State: If live credentials or API base URL are not configured in the environment,
 * returns an explicit `provider_unavailable` status rather than fabricating government data.
 */
export class GovernmentSHCProvider implements ISHCProvider {
  readonly name = 'government_shc_api';

  private apiKey = process.env.GOV_DATA_API_KEY;
  private apiBaseUrl = process.env.SHC_API_BASE_URL || 'https://soilhealth.dac.gov.in/api/v1';

  async lookupCard(cardId: string): Promise<SHCLookupResult> {
    if (!this.apiKey || this.apiKey === 'your_gov_data_api_key_placeholder') {
      return {
        status: 'provider_unavailable',
        cardId,
        reportId: `GOV-${cardId}-PENDING`,
        source: this.name,
        sourceAuthority: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        reportDate: new Date().toISOString(),
        isDemo: false,
        error: 'Government Soil Health Card API credentials (GOV_DATA_API_KEY) are not configured in this environment.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(`${this.apiBaseUrl}/cards/${encodeURIComponent(cardId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'AgriVoice-Platform/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return {
          status: 'not_found',
          cardId,
          reportId: `GOV-${cardId}-NOTFOUND`,
          source: this.name,
          sourceAuthority: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
          reportDate: new Date().toISOString(),
          isDemo: false,
          error: `Soil Health Card ${cardId} was not found in the national registry.`,
        };
      }

      if (!response.ok) {
        return {
          status: 'failed',
          cardId,
          reportId: `GOV-${cardId}-ERROR`,
          source: this.name,
          sourceAuthority: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
          reportDate: new Date().toISOString(),
          isDemo: false,
          error: `Government gateway responded with HTTP status ${response.status}: ${response.statusText}`,
        };
      }

      const raw = await response.json() as any;

      // Normalize upstream response
      return {
        status: 'available',
        cardId,
        reportId: raw.reportId || `GOV-${cardId}`,
        source: this.name,
        sourceAuthority: raw.authority || 'Department of Agriculture, Government of India',
        sampleDate: raw.sampleDate || undefined,
        testingDate: raw.testingDate || undefined,
        reportDate: raw.reportDate || new Date().toISOString(),
        state: raw.state || undefined,
        district: raw.district || undefined,
        mandal: raw.mandal || undefined,
        village: raw.village || undefined,
        soilType: raw.soilType || undefined,
        ph: typeof raw.ph === 'number' ? raw.ph : undefined,
        ec: typeof raw.ec === 'number' ? raw.ec : undefined,
        organicCarbon: typeof raw.organicCarbon === 'number' ? raw.organicCarbon : undefined,
        nitrogen: typeof raw.nitrogen === 'number' ? raw.nitrogen : undefined,
        phosphorus: typeof raw.phosphorus === 'number' ? raw.phosphorus : undefined,
        potassium: typeof raw.potassium === 'number' ? raw.potassium : undefined,
        sulphur: typeof raw.sulphur === 'number' ? raw.sulphur : undefined,
        zinc: typeof raw.zinc === 'number' ? raw.zinc : undefined,
        iron: typeof raw.iron === 'number' ? raw.iron : undefined,
        copper: typeof raw.copper === 'number' ? raw.copper : undefined,
        manganese: typeof raw.manganese === 'number' ? raw.manganese : undefined,
        boron: typeof raw.boron === 'number' ? raw.boron : undefined,
        nutrientRatings: raw.ratings || undefined,
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : undefined,
        isDemo: false,
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        status: 'provider_unavailable',
        cardId,
        reportId: `GOV-${cardId}-TIMEOUT`,
        source: this.name,
        sourceAuthority: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
        reportDate: new Date().toISOString(),
        isDemo: false,
        error: isTimeout ? 'Government API request timed out after 8 seconds.' : `Network connectivity error: ${err.message}`,
      };
    }
  }
}
