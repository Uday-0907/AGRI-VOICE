import { describe, it, expect } from 'vitest';
import { NationalInputRegistryProvider } from '../../../src/modules/soil/providers/national-input.provider.js';
import { MockInputVerificationProvider } from '../../../src/modules/soil/providers/mock-input.provider.js';

describe('Agricultural Input Verification Provider Adapters', () => {
  describe('NationalInputRegistryProvider', () => {
    it('should return provider_unavailable when API key is unconfigured', async () => {
      const provider = new NationalInputRegistryProvider();
      const result = await provider.verifyInput({
        productName: 'Sample Neem Urea',
        category: 'fertilizer',
        batchNumber: 'BATCH-2026-X',
      });

      expect(result.verificationStatus).toBe('provider_unavailable');
      expect(result.provider).toBe('cibrc_national_registry');
      expect(result.notes).toContain('credentials (INPUT_REGISTRY_API_KEY) are not configured');
    });
  });

  describe('MockInputVerificationProvider', () => {
    const provider = new MockInputVerificationProvider();

    it('should verify registered authentic fertilizer', async () => {
      const result = await provider.verifyInput({
        productName: 'Gromor Urea 46% N',
        category: 'fertilizer',
        batchNumber: 'CORO-UREA-2026',
      });

      expect(result.verificationStatus).toBe('verified');
      expect(result.brand).toContain('Gromor Urea');
      expect(result.manufacturer).toContain('Coromandel');
      expect(result.registrationNumber).toContain('FCO-AP');
      expect(result.evidence).toBeDefined();
      expect(result.evidence?.targetCrops).toContain('Paddy');
    });

    it('should verify registered authentic certified seed', async () => {
      const result = await provider.verifyInput({
        productName: 'Cotton Hybrid Seed',
        category: 'seed',
        batchNumber: 'KAVERI-JAADOO-SEED',
      });

      expect(result.verificationStatus).toBe('verified');
      expect(result.manufacturer).toContain('Kaveri Seed');
      expect(result.registrationNumber).toContain('NSC-HYB-COT');
    });

    it('should flag expired shelf-life batches truthfully', async () => {
      const result = await provider.verifyInput({
        productName: 'Sample Micro-Nutrient Mix',
        category: 'fertilizer',
        batchNumber: 'EXPIRED-BATCH-99',
      });

      expect(result.verificationStatus).toBe('expired');
      expect(result.notes).toContain('expired');
    });

    it('should flag regulatory recall alerts from agricultural enforcement', async () => {
      const result = await provider.verifyInput({
        productName: 'Suspected Chlorpyrifos',
        category: 'pesticide',
        batchNumber: 'ALERT-RECALL-FAKE',
      });

      expect(result.verificationStatus).toBe('recall_alert');
      expect(result.notes).toContain('OFFICIAL ADVISORY ALERT');
    });

    it('should handle unlisted batch with clear non-counterfeit disclaimer', async () => {
      const result = await provider.verifyInput({
        productName: 'Unknown Local Brand',
        category: 'fertilizer',
        batchNumber: 'NOTFOUND-BATCH-001',
      });

      expect(result.verificationStatus).toBe('not_found');
      expect(result.notes).toContain('Consult your local Mandal Agricultural Officer');
    });

    it('should handle inconclusive verification when certificates are missing', async () => {
      const result = await provider.verifyInput({
        productName: 'Test Inconclusive Fertilizer',
        category: 'fertilizer',
        batchNumber: 'INCONCL-BATCH-002',
      });

      expect(result.verificationStatus).toBe('inconclusive');
      expect(result.notes).toContain('certificate was not uploaded by distributor');
    });
  });
});
