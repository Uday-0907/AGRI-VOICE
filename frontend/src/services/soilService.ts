import { apiRequest } from './apiClient';
import {
  DEMO_FARMER_ID,
  DEMO_INPUT_VERIFICATIONS,
  DEMO_SOIL_DASHBOARD,
  DEMO_SOIL_REPORT,
  DEMO_VOICE_SOIL_CONTEXT,
  createDemoVoiceVerification,
} from './demoData';
import type {
  AuthSession,
  InputCategory,
  InputVerificationRecord,
  SoilDashboardData,
  SoilReport,
  VoiceInputVerification,
  VoiceSoilContext,
} from '../types/api';

let demoReportsStore: SoilReport[] = [...DEMO_SOIL_DASHBOARD.recentReports];
let demoVerificationsStore: InputVerificationRecord[] = [...DEMO_INPUT_VERIFICATIONS];

export async function fetchSoilDashboard(
  session: AuthSession
): Promise<SoilDashboardData> {
  if (session.mode === 'demo') {
    return {
      hasReport: demoReportsStore.length > 0,
      latestReport: demoReportsStore[0] ?? null,
      summary: {
        ...DEMO_SOIL_DASHBOARD.summary,
        totalReports: demoReportsStore.length,
      },
      recentReports: [...demoReportsStore],
    };
  }
  const res = await apiRequest<{ data: SoilDashboardData }>('/soil/dashboard', {
    token: session.token,
  });
  return res.data;
}

export async function lookupSoilCard(
  session: AuthSession,
  payload: {
    cardId: string;
    farmId?: string;
    fieldId?: string;
    providerMode?: 'auto' | 'government' | 'demo';
  }
): Promise<SoilReport> {
  if (session.mode === 'demo') {
    const newReport: SoilReport = {
      ...DEMO_SOIL_REPORT,
      id: `demo-${Date.now()}`,
      cardId: payload.cardId.trim(),
      reportId: payload.cardId.trim(),
      farmId: payload.farmId ?? DEMO_SOIL_REPORT.farmId,
      fieldId: payload.fieldId ?? DEMO_SOIL_REPORT.fieldId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoReportsStore = [newReport, ...demoReportsStore];
    return newReport;
  }

  const res = await apiRequest<{ data: SoilReport }>('/soil/lookup', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function listSoilReports(
  session: AuthSession,
  limit = 20,
  offset = 0
): Promise<{ data: SoilReport[]; total: number }> {
  if (session.mode === 'demo') {
    return {
      data: demoReportsStore.slice(offset, offset + limit),
      total: demoReportsStore.length,
    };
  }

  const res = await apiRequest<{
    data: SoilReport[];
    meta?: { pagination?: { total: number } };
  }>(`/soil/reports?limit=${limit}&offset=${offset}`, {
    token: session.token,
  });
  return {
    data: res.data,
    total: res.meta?.pagination?.total ?? res.data.length,
  };
}

export async function refreshSoilReport(
  session: AuthSession,
  reportId: string
): Promise<SoilReport> {
  if (session.mode === 'demo') {
    const existing = demoReportsStore.find((r) => r.id === reportId) ?? DEMO_SOIL_REPORT;
    const updated: SoilReport = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };
    demoReportsStore = demoReportsStore.map((r) => (r.id === reportId ? updated : r));
    return updated;
  }

  const res = await apiRequest<{ data: SoilReport }>(`/soil/reports/${reportId}/refresh`, {
    method: 'POST',
    token: session.token,
  });
  return res.data;
}

export async function verifyInputProduct(
  session: AuthSession,
  payload: {
    productName: string;
    category: InputCategory;
    brand?: string;
    manufacturer?: string;
    batchNumber?: string;
    registrationNumber?: string;
    providerMode?: 'auto' | 'official' | 'demo';
  }
): Promise<InputVerificationRecord> {
  if (session.mode === 'demo') {
    const record: InputVerificationRecord = {
      id: `verify-${Date.now()}`,
      farmerId: DEMO_FARMER_ID,
      productName: payload.productName.trim(),
      category: payload.category,
      brand: payload.brand?.trim() || null,
      manufacturer: payload.manufacturer?.trim() || null,
      batchNumber: payload.batchNumber?.trim() || null,
      registrationNumber: payload.registrationNumber?.trim() || null,
      verificationStatus: 'demo',
      source: 'demo_input_provider',
      evidence:
        'Demo preview result using synthetic catalog only. Connect official FCO/CIBRC registry on live backend for regulatory status.',
      notes: 'Synthetic demonstration response.',
      isDemo: 'true',
      createdAt: new Date().toISOString(),
    };
    demoVerificationsStore = [record, ...demoVerificationsStore];
    return record;
  }

  const res = await apiRequest<{ data: InputVerificationRecord }>('/soil/inputs/verify', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function listInputVerifications(
  session: AuthSession,
  limit = 20,
  offset = 0
): Promise<{ data: InputVerificationRecord[]; total: number }> {
  if (session.mode === 'demo') {
    return {
      data: demoVerificationsStore.slice(offset, offset + limit),
      total: demoVerificationsStore.length,
    };
  }

  const res = await apiRequest<{
    data: InputVerificationRecord[];
    meta?: { pagination?: { total: number } };
  }>(`/soil/inputs/verifications?limit=${limit}&offset=${offset}`, {
    token: session.token,
  });
  return {
    data: res.data,
    total: res.meta?.pagination?.total ?? res.data.length,
  };
}

export async function fetchVoiceSoilContext(
  session: AuthSession
): Promise<VoiceSoilContext> {
  if (session.mode === 'demo') {
    return DEMO_VOICE_SOIL_CONTEXT;
  }
  const res = await apiRequest<{ data: VoiceSoilContext }>('/soil/voice/context', {
    token: session.token,
  });
  return res.data;
}

export async function verifyInputForVoice(
  session: AuthSession,
  payload: {
    productName: string;
    category: InputCategory;
    brand?: string;
    batchNumber?: string;
    providerMode?: 'auto' | 'official' | 'demo';
  }
): Promise<VoiceInputVerification> {
  if (session.mode === 'demo') {
    return createDemoVoiceVerification(
      payload.productName,
      payload.category,
      payload.brand,
      payload.batchNumber
    );
  }

  const res = await apiRequest<{ data: VoiceInputVerification }>('/soil/voice/verify-input', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}
