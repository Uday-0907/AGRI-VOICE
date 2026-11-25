export interface SHCLookupResult {
  status: 'available' | 'not_found' | 'failed' | 'provider_unavailable' | 'demo' | 'partial';
  cardId: string;
  reportId: string;
  source: string;
  sourceAuthority?: string;
  sampleDate?: string;
  testingDate?: string;
  reportDate: string;
  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
  soilType?: string;

  // Measurements
  ph?: number | null;
  ec?: number | null;
  organicCarbon?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  sulphur?: number | null;
  zinc?: number | null;
  iron?: number | null;
  copper?: number | null;
  manganese?: number | null;
  boron?: number | null;

  nutrientRatings?: Record<string, string>;
  recommendations?: Array<{
    crop: string;
    fertilizer: string;
    dosageKgPerAcre: number;
    note?: string;
  }>;
  isDemo: boolean;
  error?: string;
}

export interface ISHCProvider {
  readonly name: string;
  lookupCard(cardId: string): Promise<SHCLookupResult>;
}
