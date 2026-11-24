import { IInputVerificationProvider, InputVerificationParams, InputVerificationResult } from './input-verification-provider.interface.js';

/**
 * Mock / Demo Agricultural Input Verification Provider Adapter.
 * Provides verifiable sample entries for fertilizers, hybrid seeds, and plant protection chemicals.
 *
 * Safety Invariant: All demonstration records are strictly synthetic reference samples.
 * Every result returns `verificationStatus: 'demo'`.
 * No real brand, manufacturer, or product is referenced or accused of regulatory violations.
 * Synthetic fixtures never produce authoritative 'verified', 'recall_alert', or 'expired' statuses.
 */
export class MockInputVerificationProvider implements IInputVerificationProvider {
  readonly name = 'demo_input_registry';

  // Sample database of demonstration batches with simulated scenarios
  private sampleCatalog: Record<string, {
    brand: string;
    manufacturer: string;
    category: 'fertilizer' | 'seed' | 'pesticide' | 'bio_stimulant';
    simulatedScenario: 'registered_sample' | 'simulated_expired' | 'simulated_recall_alert' | 'unregistered_sample';
    registrationNumber: string;
    validUntil: string;
    crops: string[];
    notes: string;
  }> = {
    'DEMO-FERT-NPK-001': {
      brand: 'DemoBio Complex NPK 20-20-20 (Synthetic Sample)',
      manufacturer: 'Demo Agrochemicals Lab Ltd (Fictional Entity)',
      category: 'fertilizer',
      simulatedScenario: 'registered_sample',
      registrationNumber: 'DEMO-REG-FCO-2026-001',
      validUntil: '2028-12-31',
      crops: ['Paddy', 'Chilli', 'Cotton', 'Maize'],
      notes: 'DEMONSTRATION SAMPLE ONLY: Fictional reference formulation for testing. Not an official regulatory determination.',
    },
    'DEMO-SEED-HYB-002': {
      brand: 'DemoHybrid Cotton Seed DHC-9 (Synthetic Sample)',
      manufacturer: 'Demo Seeds Corporation (Fictional Entity)',
      category: 'seed',
      simulatedScenario: 'registered_sample',
      registrationNumber: 'DEMO-REG-NSC-2026-002',
      validUntil: '2027-03-31',
      crops: ['Cotton'],
      notes: 'DEMONSTRATION SAMPLE ONLY: Fictional seed variety reference for testing. Not an official regulatory determination.',
    },
    'DEMO-EXPIRED-BATCH-003': {
      brand: 'DemoCrop Micronutrient Mix (Expired Test Sample)',
      manufacturer: 'Demo Nutrients Corp (Fictional Entity)',
      category: 'fertilizer',
      simulatedScenario: 'simulated_expired',
      registrationNumber: 'DEMO-REG-EXP-2020-003',
      validUntil: '2024-01-01',
      crops: ['All Crops'],
      notes: 'DEMONSTRATION SAMPLE ONLY: Fictional expired shelf-life test fixture. Not an official regulatory finding.',
    },
    'DEMO-RECALL-ALERT-004': {
      brand: 'DemoShield Plant Protectant (Recall Test Sample)',
      manufacturer: 'Demo Plant Protection Ltd (Fictional Entity)',
      category: 'pesticide',
      simulatedScenario: 'simulated_recall_alert',
      registrationNumber: 'DEMO-REG-ALERT-2021-004',
      validUntil: '2023-01-01',
      crops: [],
      notes: 'DEMONSTRATION SAMPLE ONLY: Fictional recall advisory test fixture. Not an official regulatory finding.',
    },
  };

  async verifyInput(params: InputVerificationParams): Promise<InputVerificationResult> {
    const batchKey = (params.batchNumber || '').trim().toUpperCase();
    const nameKey = (params.productName || '').trim().toUpperCase();

    // Check matching batch or product keyword
    const match = this.sampleCatalog[batchKey] ||
      Object.entries(this.sampleCatalog).find(([k, v]) => nameKey.includes(k) || v.brand.toUpperCase().includes(nameKey))?.[1];

    if (!match) {
      if (batchKey.startsWith('NOTFOUND') || nameKey.startsWith('NOTFOUND')) {
        return {
          verificationStatus: 'demo',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          brand: params.brand || 'Unlisted Demo Product',
          batchNumber: params.batchNumber,
          evidence: {
            isDemo: true,
            simulatedScenario: 'unregistered_sample',
            disclaimer: 'DEMONSTRATION SAMPLE ONLY: Fictional unregistered test query. Not an official regulatory finding.',
          },
          notes: 'DEMONSTRATION NOTICE: Product batch not found in demo reference catalog. This is a demonstration query, not an official registry search.',
        };
      }

      if (batchKey.startsWith('INCONCL') || nameKey.startsWith('INCONCL')) {
        return {
          verificationStatus: 'demo',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          brand: params.brand || 'Inconclusive Demo Product',
          batchNumber: params.batchNumber,
          evidence: {
            isDemo: true,
            simulatedScenario: 'simulated_inconclusive',
            disclaimer: 'DEMONSTRATION SAMPLE ONLY: Fictional unconfirmed test scenario. Not an official regulatory finding.',
          },
          notes: 'DEMONSTRATION NOTICE: Simulated inconclusive batch test scenario. Not an official regulatory finding.',
        };
      }

      // Default fallback for demo mode
      return {
        verificationStatus: 'demo',
        provider: this.name,
        productName: params.productName,
        category: params.category,
        brand: params.brand || 'Synthetic Demo Brand',
        batchNumber: params.batchNumber || 'DEMO-BATCH-001',
        registrationNumber: 'DEMO-REG-4401',
        evidence: {
          isDemo: true,
          simulatedScenario: 'unknown_sample',
          disclaimer: 'DEMONSTRATION SAMPLE ONLY: This record was generated in a local test catalog. It does not represent an official regulatory finding or government registry verification.',
          licensedManufacturer: params.manufacturer || 'Demo Manufacturer (Fictional Entity)',
          registeredFormula: `${params.productName} (Demo Grade)`,
          validUntil: '2027-12-31',
          targetCrops: ['Paddy', 'Chilli', 'Cotton'],
          officialNotice: 'DEMO verification record generated for testing without live CIBRC/FCO connection.',
        },
        notes: 'DEMONSTRATION ONLY: Verification record generated for testing without live CIBRC/FCO connection.',
      };
    }

    return {
      verificationStatus: 'demo',
      provider: this.name,
      productName: params.productName,
      category: match.category,
      brand: match.brand,
      manufacturer: match.manufacturer,
      batchNumber: params.batchNumber,
      registrationNumber: match.registrationNumber,
      evidence: {
        isDemo: true,
        simulatedScenario: match.simulatedScenario,
        disclaimer: 'DEMONSTRATION SAMPLE ONLY: This record was generated in a local test catalog. It does not represent an official regulatory finding or government registry verification.',
        licensedManufacturer: match.manufacturer,
        registeredFormula: match.brand,
        validUntil: match.validUntil,
        targetCrops: match.crops,
        officialNotice: match.notes,
      },
      notes: match.notes,
    };
  }
}
