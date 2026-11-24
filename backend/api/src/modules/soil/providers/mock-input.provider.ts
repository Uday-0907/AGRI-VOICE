import { IInputVerificationProvider, InputVerificationParams, InputVerificationResult } from './input-verification-provider.interface.js';

/**
 * Mock / Demo Agricultural Input Verification Provider Adapter.
 * Provides verifiable sample entries for fertilizers, hybrid seeds, and plant protection chemicals.
 */
export class MockInputVerificationProvider implements IInputVerificationProvider {
  readonly name = 'demo_input_registry';

  // Sample database of registered genuine and alerted batches
  private sampleCatalog: Record<string, {
    brand: string;
    manufacturer: string;
    category: 'fertilizer' | 'seed' | 'pesticide' | 'bio_stimulant';
    status: 'verified' | 'expired' | 'recall_alert' | 'inconclusive';
    registrationNumber: string;
    validUntil: string;
    crops: string[];
    notes: string;
  }> = {
    'CORO-UREA-2026': {
      brand: 'Gromor Urea 46% N',
      manufacturer: 'Coromandel International Ltd',
      category: 'fertilizer',
      status: 'verified',
      registrationNumber: 'FCO-AP-2023-9941',
      validUntil: '2028-12-31',
      crops: ['Paddy', 'Chilli', 'Cotton', 'Maize'],
      notes: 'Certified Neem Coated Urea adhering to Indian Fertilizer Control Order standard specifications.',
    },
    'BAYER-CONFIDOR-200': {
      brand: 'Confidor 200 SL (Imidacloprid 17.8% SL)',
      manufacturer: 'Bayer CropScience Ltd',
      category: 'pesticide',
      status: 'verified',
      registrationNumber: 'CIR-22441/2001-Imidacloprid(SL)-241',
      validUntil: '2027-06-30',
      crops: ['Cotton', 'Paddy', 'Chilli', 'Sugarcane'],
      notes: 'Authentic formulation registered under Central Insecticides Board (CIB&RC).',
    },
    'KAVERI-JAADOO-SEED': {
      brand: 'Kaveri Cotton Hybrid Seed Jaadoo BG-II',
      manufacturer: 'Kaveri Seed Company Ltd',
      category: 'seed',
      status: 'verified',
      registrationNumber: 'NSC-HYB-COT-4109',
      validUntil: '2027-03-31',
      crops: ['Cotton'],
      notes: 'Govt certified seed germination rate >= 75%, genetic purity >= 90%.',
    },
    'EXPIRED-BATCH-99': {
      brand: 'Sample Micro-Nutrient Mix',
      manufacturer: 'AgriChem Labs India',
      category: 'fertilizer',
      status: 'expired',
      registrationNumber: 'FCO-TS-2020-1122',
      validUntil: '2024-01-01',
      crops: ['All Crops'],
      notes: 'Product batch shelf-life has expired. Efficacy cannot be guaranteed; do not use.',
    },
    'ALERT-RECALL-FAKE': {
      brand: 'Suspected Counterfeit Chlorpyrifos 20% EC',
      manufacturer: 'Unknown / Suspended License Entity',
      category: 'pesticide',
      status: 'recall_alert',
      registrationNumber: 'INVALID-SUSPENDED',
      validUntil: '2023-01-01',
      crops: [],
      notes: 'OFFICIAL ADVISORY ALERT: State Agriculture Vigilance department flagged this batch as unauthorized dilution.',
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
          verificationStatus: 'not_found',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          brand: params.brand,
          batchNumber: params.batchNumber,
          notes: 'No matching batch or registration record found in demo input database. Consult your local Mandal Agricultural Officer (MAO) to verify authenticity.',
        };
      }

      if (batchKey.startsWith('INCONCL') || nameKey.startsWith('INCONCL')) {
        return {
          verificationStatus: 'inconclusive',
          provider: this.name,
          productName: params.productName,
          category: params.category,
          brand: params.brand,
          batchNumber: params.batchNumber,
          notes: 'Manufacturer registration exists, but batch manufacturing certificate was not uploaded by distributor.',
        };
      }

      // Default fallback for demo mode
      return {
        verificationStatus: 'demo',
        provider: this.name,
        productName: params.productName,
        category: params.category,
        brand: params.brand || 'Demo Manufacturer',
        batchNumber: params.batchNumber || 'DEMO-BATCH-001',
        registrationNumber: 'DEMO-REG-4401',
        evidence: {
          licensedManufacturer: params.manufacturer || 'Certified Agri-Input Producer',
          registeredFormula: `${params.productName} Standard Grade`,
          validUntil: '2027-12-31',
          targetCrops: ['Paddy', 'Chilli', 'Cotton'],
          officialNotice: 'DEMO Record: Verified in local demonstration test suite.',
        },
        notes: 'DEMO verification record generated for testing without live CIBRC/FCO connection.',
      };
    }

    return {
      verificationStatus: match.status,
      provider: this.name,
      productName: params.productName,
      category: match.category,
      brand: match.brand,
      manufacturer: match.manufacturer,
      batchNumber: params.batchNumber,
      registrationNumber: match.registrationNumber,
      evidence: {
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
