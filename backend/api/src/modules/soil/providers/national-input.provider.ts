import { IInputVerificationProvider, InputVerificationParams, InputVerificationResult } from './input-verification-provider.interface.js';

/**
 * Official Central Insecticides Board (CIBRC) & Fertilizer Control Order (FCO)
 * National Input Registration Authority Provider Adapter.
 */
export class NationalInputRegistryProvider implements IInputVerificationProvider {
  readonly name = 'cibrc_national_registry';

  private apiKey = process.env.INPUT_REGISTRY_API_KEY;
  private apiBaseUrl = process.env.INPUT_REGISTRY_BASE_URL;

  async verifyInput(params: InputVerificationParams): Promise<InputVerificationResult> {
    if (!this.apiKey || !this.apiBaseUrl) {
      return {
        verificationStatus: 'provider_unavailable',
        provider: this.name,
        productName: params.productName,
        category: params.category,
        brand: params.brand,
        manufacturer: params.manufacturer,
        batchNumber: params.batchNumber,
        registrationNumber: params.registrationNumber,
        notes: 'National CIBRC/FCO input registration gateway credentials (INPUT_REGISTRY_API_KEY) are not configured in this environment.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${this.apiBaseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AgriVoice-Platform/1.0',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return {
          verificationStatus: 'not_found',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          brand: params.brand,
          batchNumber: params.batchNumber,
          notes: 'No official registration record found for this batch/product in the national gazette database. Does not conclusively indicate counterfeit; manual retailer verification advised.',
        };
      }

      if (!response.ok) {
        return {
          verificationStatus: 'inconclusive',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          notes: `Upstream verification server returned error status ${response.status}.`,
        };
      }

      const data = await response.json() as any;

      return {
        verificationStatus: data.status || 'verified',
        provider: this.name,
        productName: params.productName,
        category: params.category,
        brand: data.brand || params.brand,
        manufacturer: data.manufacturer || params.manufacturer,
        batchNumber: params.batchNumber,
        registrationNumber: data.registrationNumber || params.registrationNumber,
        evidence: data.evidence || undefined,
        notes: data.notes || 'Verified against Ministry of Agriculture registered chemical/seed catalog.',
      };
    } catch (err: any) {
      return {
        verificationStatus: 'provider_unavailable',
        provider: this.name,
        productName: params.productName,
        category: params.category,
        notes: `Network error connecting to national input verification gateway: ${err.message}`,
      };
    }
  }
}
