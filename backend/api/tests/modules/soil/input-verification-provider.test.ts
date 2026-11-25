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

  describe('MockInputVerificationProvider (Demo Mode & Safety Invariants)', () => {
    const provider = new MockInputVerificationProvider();

    it('should return demo status for synthetic reference fertilizer fixture', async () => {
      const result = await provider.verifyInput({
        productName: 'DemoBio Complex NPK 20-20-20',
        category: 'fertilizer',
        batchNumber: 'DEMO-FERT-NPK-001',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.provider).toBe('demo_input_registry');
      expect(result.brand).toContain('DemoBio Complex NPK');
      expect(result.manufacturer).toContain('Fictional Entity');
      expect(result.registrationNumber).toContain('DEMO-REG-FCO');
      expect(result.evidence).toBeDefined();
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('registered_sample');
      expect(result.evidence?.disclaimer).toContain('DEMONSTRATION SAMPLE ONLY');
      expect(result.notes).toContain('DEMONSTRATION SAMPLE ONLY');
    });

    it('should return demo status for synthetic reference certified seed fixture', async () => {
      const result = await provider.verifyInput({
        productName: 'DemoHybrid Cotton Seed',
        category: 'seed',
        batchNumber: 'DEMO-SEED-HYB-002',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.provider).toBe('demo_input_registry');
      expect(result.manufacturer).toContain('Fictional Entity');
      expect(result.registrationNumber).toContain('DEMO-REG-NSC');
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('registered_sample');
    });

    it('should return demo status (never real expired) for simulated expired batch fixture', async () => {
      const result = await provider.verifyInput({
        productName: 'DemoCrop Micronutrient Mix',
        category: 'fertilizer',
        batchNumber: 'DEMO-EXPIRED-BATCH-003',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('simulated_expired');
      expect(result.notes).toContain('DEMONSTRATION SAMPLE ONLY');
      expect(result.notes).toContain('Not an official regulatory finding');
    });

    it('should return demo status (never real recall_alert) for simulated recall alert fixture', async () => {
      const result = await provider.verifyInput({
        productName: 'DemoShield Plant Protectant',
        category: 'pesticide',
        batchNumber: 'DEMO-RECALL-ALERT-004',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('simulated_recall_alert');
      expect(result.notes).toContain('DEMONSTRATION SAMPLE ONLY');
    });

    it('should return demo status for unlisted demo batch with clear disclaimer', async () => {
      const result = await provider.verifyInput({
        productName: 'Unknown Demo Brand',
        category: 'fertilizer',
        batchNumber: 'NOTFOUND-DEMO-001',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('unregistered_sample');
      expect(result.notes).toContain('DEMONSTRATION NOTICE');
    });

    it('should return demo status for simulated inconclusive test batch', async () => {
      const result = await provider.verifyInput({
        productName: 'Demo Inconclusive Fertilizer',
        category: 'fertilizer',
        batchNumber: 'INCONCL-DEMO-002',
      });

      expect(result.verificationStatus).toBe('demo');
      expect(result.evidence?.isDemo).toBe(true);
      expect(result.evidence?.simulatedScenario).toBe('simulated_inconclusive');
      expect(result.notes).toContain('DEMONSTRATION NOTICE');
    });

    it('should NEVER return authoritative statuses from demo provider', async () => {
      const testBatches = [
        'DEMO-FERT-NPK-001',
        'DEMO-SEED-HYB-002',
        'DEMO-EXPIRED-BATCH-003',
        'DEMO-RECALL-ALERT-004',
        'NOTFOUND-DEMO-001',
        'INCONCL-DEMO-002',
        'RANDOM-BATCH-999',
      ];

      for (const batch of testBatches) {
        const result = await provider.verifyInput({
          productName: 'Sample Product',
          category: 'fertilizer',
          batchNumber: batch,
        });

        // Demo provider MUST ALWAYS return status 'demo'
        expect(result.verificationStatus).toBe('demo');
        expect(result.verificationStatus).not.toBe('verified');
        expect(result.verificationStatus).not.toBe('recall_alert');
        expect(result.verificationStatus).not.toBe('expired');
      }
    });
  });
});
