import { apiRequest } from './apiClient';
import type { AuthSession } from '../types/api';

export interface MarketPriceItem {
  id: string;
  commodity: string;
  variety?: string | null;
  state: string;
  district: string;
  marketName: string;
  minPriceInr: number;
  maxPriceInr: number;
  modalPriceInr: number;
  unit: string;
  priceDate: string;
  source: string;
  sourceAuthority?: string | null;
}

export interface BuyerListingItem {
  id: string;
  farmerId: string;
  cropName: string;
  variety?: string | null;
  quantityQuintals: number;
  expectedPriceInr: number;
  qualityGrade?: string | null;
  district: string;
  state: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface MachineryListingItem {
  id: string;
  ownerFarmerId: string;
  equipmentName: string;
  category: string;
  hourlyRateInr: number;
  dailyRateInr?: number | null;
  district: string;
  state: string;
  availabilityStatus: string;
  description?: string | null;
}

export interface MachineryBookingItem {
  id: string;
  listingId: string;
  renterFarmerId: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
}

export interface InstitutionalSchemeItem {
  id: string;
  schemeCode: string;
  title: string;
  category: string;
  authority: string;
  eligibilitySummary: string;
  benefitSummary: string;
  applicationUrl?: string | null;
  source: string;
}

export interface SchemeApplicationItem {
  id: string;
  schemeCode: string;
  schemeTitle: string;
  category: string;
  status: string;
  notes?: string | null;
  submittedAt: string;
}

export interface ExtensionBulletinItem {
  id: string;
  bulletinCode: string;
  title: string;
  crop: string;
  category: string;
  summary: string;
  recommendationText: string;
  sourceAuthority: string;
  state?: string | null;
  publishedDate: string;
}

export interface FarmerFieldQueryItem {
  id: string;
  crop: string;
  topic: string;
  questionText: string;
  status: string;
  answerText?: string | null;
  createdAt: string;
}

// Isolated Demo Mode stores (never mixed with live backend data)
let demoPrices: MarketPriceItem[] = [
  {
    id: 'demo-price-1',
    commodity: 'Paddy (Common)',
    variety: 'MTU-1010',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    marketName: 'Tenali APMC (Demo Sample)',
    minPriceInr: 2180,
    maxPriceInr: 2340,
    modalPriceInr: 2260,
    unit: 'Rs/Quintal',
    priceDate: new Date().toISOString(),
    source: 'demo',
    sourceAuthority: 'Demo Preview Fixture',
  },
];
let demoListings: BuyerListingItem[] = [];
let demoMachinery: MachineryListingItem[] = [
  {
    id: 'demo-mach-1',
    ownerFarmerId: 'f0000000-0000-0000-0000-000000000001',
    equipmentName: 'John Deere 5050D Tractor + Rotavator (Demo)',
    category: 'tractor',
    hourlyRateInr: 950,
    dailyRateInr: 6500,
    district: 'Guntur',
    state: 'Andhra Pradesh',
    availabilityStatus: 'available',
    description: 'Sample demo equipment listing for preview.',
  },
];
let demoBookings: MachineryBookingItem[] = [];
const demoSchemes: InstitutionalSchemeItem[] = [
  {
    id: 'demo-sch-1',
    schemeCode: 'PM-KISAN',
    title: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    category: 'subsidy',
    authority: 'Ministry of Agriculture & Farmers Welfare (Public Reference)',
    eligibilitySummary: 'Small and marginal landholding farmer families.',
    benefitSummary: 'Rs. 6,000/year in 3 equal installments.',
    applicationUrl: 'https://pmkisan.gov.in/',
    source: 'public_reference',
  },
  {
    id: 'demo-sch-2',
    schemeCode: 'PMFBY',
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    category: 'insurance',
    authority: 'Department of Agriculture & Farmers Welfare (Public Reference)',
    eligibilitySummary: 'Farmers growing notified crops in notified areas.',
    benefitSummary: 'Crop loss insurance coverage.',
    applicationUrl: 'https://pmfby.gov.in/',
    source: 'public_reference',
  },
];
let demoApplications: SchemeApplicationItem[] = [];
const demoBulletins: ExtensionBulletinItem[] = [
  {
    id: 'demo-bul-1',
    bulletinCode: 'ICAR-PADDY-AWD-01',
    title: 'Alternate Wetting and Drying (AWD) Irrigation in Paddy',
    crop: 'Paddy',
    category: 'water',
    summary: 'Reduces irrigation water use by 15-25% without yield penalty.',
    recommendationText: 'Maintain 2-3 cm water at transplanting; allow 10-15 cm recession before next irrigation in mid-tillering.',
    sourceAuthority: 'ICAR-IIRR (Public Reference)',
    state: 'Andhra Pradesh',
    publishedDate: new Date().toISOString(),
  },
];
let demoQueries: FarmerFieldQueryItem[] = [];

export async function fetchMarketPrices(
  session: AuthSession,
  filters: { commodity?: string; district?: string } = {}
): Promise<MarketPriceItem[]> {
  if (session.mode === 'demo') {
    return demoPrices.filter((p) => {
      if (filters.commodity && !p.commodity.toLowerCase().includes(filters.commodity.toLowerCase())) return false;
      if (filters.district && !p.district.toLowerCase().includes(filters.district.toLowerCase())) return false;
      return true;
    });
  }
  const params = new URLSearchParams();
  if (filters.commodity) params.set('commodity', filters.commodity);
  if (filters.district) params.set('district', filters.district);
  const res = await apiRequest<{ data: MarketPriceItem[] }>(`/markets/prices?${params.toString()}`, {
    token: session.token,
  });
  return res.data;
}

export async function createMarketPrice(
  session: AuthSession,
  payload: Omit<MarketPriceItem, 'id' | 'unit' | 'priceDate' | 'source' | 'sourceAuthority'>
): Promise<MarketPriceItem> {
  if (session.mode === 'demo') {
    const item: MarketPriceItem = {
      ...payload,
      id: `demo-price-${Date.now()}`,
      unit: 'Rs/Quintal',
      priceDate: new Date().toISOString(),
      source: 'demo',
      sourceAuthority: 'Demo Preview Fixture',
    };
    demoPrices = [item, ...demoPrices];
    return item;
  }
  const res = await apiRequest<{ data: MarketPriceItem }>('/markets/prices', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchBuyerListings(session: AuthSession): Promise<BuyerListingItem[]> {
  if (session.mode === 'demo') return demoListings;
  const res = await apiRequest<{ data: BuyerListingItem[] }>('/markets/listings?scope=mine', {
    token: session.token,
  });
  return res.data;
}

export async function createBuyerListing(
  session: AuthSession,
  payload: {
    cropName: string;
    variety?: string;
    quantityQuintals: number;
    expectedPriceInr: number;
    qualityGrade?: string;
    district: string;
    state: string;
    notes?: string;
  }
): Promise<BuyerListingItem> {
  if (session.mode === 'demo') {
    const item: BuyerListingItem = {
      ...payload,
      id: `demo-list-${Date.now()}`,
      farmerId: session.farmerProfile?.id || 'demo',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    demoListings = [item, ...demoListings];
    return item;
  }
  const res = await apiRequest<{ data: BuyerListingItem }>('/markets/listings', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchMachineryListings(
  session: AuthSession,
  filters: { category?: string; district?: string } = {}
): Promise<MachineryListingItem[]> {
  if (session.mode === 'demo') {
    return demoMachinery.filter((m) => {
      if (filters.category && m.category !== filters.category) return false;
      if (filters.district && !m.district.toLowerCase().includes(filters.district.toLowerCase())) return false;
      return true;
    });
  }
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.district) params.set('district', filters.district);
  const res = await apiRequest<{ data: MachineryListingItem[] }>(`/machinery/listings?${params.toString()}`, {
    token: session.token,
  });
  return res.data;
}

export async function createMachineryListing(
  session: AuthSession,
  payload: {
    equipmentName: string;
    category: string;
    hourlyRateInr: number;
    dailyRateInr?: number;
    district: string;
    state: string;
    description?: string;
  }
): Promise<MachineryListingItem> {
  if (session.mode === 'demo') {
    const item: MachineryListingItem = {
      ...payload,
      id: `demo-mach-${Date.now()}`,
      ownerFarmerId: session.farmerProfile?.id || 'demo',
      availabilityStatus: 'available',
    };
    demoMachinery = [item, ...demoMachinery];
    return item;
  }
  const res = await apiRequest<{ data: MachineryListingItem }>('/machinery/listings', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchMachineryBookings(session: AuthSession): Promise<MachineryBookingItem[]> {
  if (session.mode === 'demo') return demoBookings;
  const res = await apiRequest<{ data: MachineryBookingItem[] }>('/machinery/bookings', {
    token: session.token,
  });
  return res.data;
}

export async function createMachineryBooking(
  session: AuthSession,
  payload: { listingId: string; startDate: string; endDate: string; notes?: string }
): Promise<MachineryBookingItem> {
  if (session.mode === 'demo') {
    const item: MachineryBookingItem = {
      ...payload,
      id: `demo-book-${Date.now()}`,
      renterFarmerId: session.farmerProfile?.id || 'demo',
      status: 'requested',
    };
    demoBookings = [item, ...demoBookings];
    return item;
  }
  const res = await apiRequest<{ data: MachineryBookingItem }>('/machinery/bookings', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchInstitutionalSchemes(session: AuthSession): Promise<InstitutionalSchemeItem[]> {
  if (session.mode === 'demo') return demoSchemes;
  const res = await apiRequest<{ data: InstitutionalSchemeItem[] }>('/institutions/schemes', {
    token: session.token,
  });
  return res.data;
}

export async function fetchSchemeApplications(session: AuthSession): Promise<SchemeApplicationItem[]> {
  if (session.mode === 'demo') return demoApplications;
  const res = await apiRequest<{ data: SchemeApplicationItem[] }>('/institutions/applications', {
    token: session.token,
  });
  return res.data;
}

export async function submitSchemeApplication(
  session: AuthSession,
  payload: { schemeCode: string; schemeTitle: string; category: string; farmId?: string; notes?: string }
): Promise<SchemeApplicationItem> {
  if (session.mode === 'demo') {
    const item: SchemeApplicationItem = {
      ...payload,
      id: `demo-app-${Date.now()}`,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    demoApplications = [item, ...demoApplications];
    return item;
  }
  const res = await apiRequest<{ data: SchemeApplicationItem }>('/institutions/applications', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchExtensionBulletins(
  session: AuthSession,
  crop?: string
): Promise<ExtensionBulletinItem[]> {
  if (session.mode === 'demo') {
    return crop
      ? demoBulletins.filter((b) => b.crop.toLowerCase().includes(crop.toLowerCase()))
      : demoBulletins;
  }
  const q = crop ? `?crop=${encodeURIComponent(crop)}` : '';
  const res = await apiRequest<{ data: ExtensionBulletinItem[] }>(`/research/bulletins${q}`, {
    token: session.token,
  });
  return res.data;
}

export async function fetchFieldQueries(session: AuthSession): Promise<FarmerFieldQueryItem[]> {
  if (session.mode === 'demo') return demoQueries;
  const res = await apiRequest<{ data: FarmerFieldQueryItem[] }>('/research/queries', {
    token: session.token,
  });
  return res.data;
}

export async function submitFieldQuery(
  session: AuthSession,
  payload: { crop: string; topic: string; questionText: string }
): Promise<FarmerFieldQueryItem> {
  if (session.mode === 'demo') {
    const item: FarmerFieldQueryItem = {
      ...payload,
      id: `demo-qry-${Date.now()}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    demoQueries = [item, ...demoQueries];
    return item;
  }
  const res = await apiRequest<{ data: FarmerFieldQueryItem }>('/research/queries', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}
