export interface InputVerificationParams {
  productName: string;
  category: 'fertilizer' | 'seed' | 'pesticide' | 'bio_stimulant' | 'other';
  brand?: string;
  manufacturer?: string;
  batchNumber?: string;
  registrationNumber?: string;
}

export interface InputVerificationResult {
  verificationStatus: 'verified' | 'not_verified' | 'inconclusive' | 'not_found' | 'expired' | 'recall_alert' | 'provider_unavailable' | 'demo';
  provider: string;
  productName: string;
  category: string;
  brand?: string;
  manufacturer?: string;
  batchNumber?: string;
  registrationNumber?: string;
  evidence?: {
    licensedManufacturer?: string;
    registeredFormula?: string;
    validUntil?: string;
    targetCrops?: string[];
    officialNotice?: string;
  };
  notes?: string;
}

export interface IInputVerificationProvider {
  readonly name: string;
  verifyInput(params: InputVerificationParams): Promise<InputVerificationResult>;
}
