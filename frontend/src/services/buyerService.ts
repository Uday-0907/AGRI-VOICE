import { apiRequest } from './apiClient';
import type { AuthSession, BuyerProfile } from '../types/api';

export interface PublicProduceListing {
  id: string;
  cropName: string;
  variety?: string | null;
  quantityQuintals: number;
  expectedPriceInr: number;
  qualityGrade?: string | null;
  district: string;
  state: string;
  status: string;
  notes?: string | null;
  sellerName: string;
  isSaved: boolean;
  createdAt: string;
}

export interface PurchaseRequestItem {
  id: string;
  listingId: string;
  buyerId: string;
  farmerId: string;
  requestType: 'enquiry' | 'purchase_request';
  requestedQuantityQuintals: number;
  offeredPriceInr: number;
  message?: string | null;
  farmerResponse?: string | null;
  status: string;
  cropName?: string;
  district?: string;
  state?: string;
  sellerName?: string;
  buyerBusinessName?: string;
  buyerContactName?: string;
  buyerLocation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerDashboardData {
  buyerProfile: BuyerProfile;
  summary: {
    availableProduceCount: number;
    pendingRequestsCount: number;
    acceptedOrdersCount: number;
    unreadNotificationsCount: number;
  };
  recentRequests: PurchaseRequestItem[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  role: string;
  category: string;
  title: string;
  message: string;
  relatedEntityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function fetchBuyerDashboard(session: AuthSession): Promise<BuyerDashboardData> {
  const res = await apiRequest<{ data: BuyerDashboardData }>('/buyer/dashboard', { token: session.token });
  return res.data;
}

export async function updateBuyerProfile(
  session: AuthSession,
  payload: Partial<BuyerProfile>
): Promise<BuyerProfile> {
  const res = await apiRequest<{ data: BuyerProfile }>('/buyer/profile', {
    method: 'PUT',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function browseOpenProduce(
  session: AuthSession,
  filters: { crop?: string; district?: string; minQty?: number; maxPrice?: number } = {}
): Promise<PublicProduceListing[]> {
  const params = new URLSearchParams();
  if (filters.crop) params.set('crop', filters.crop);
  if (filters.district) params.set('district', filters.district);
  if (filters.minQty) params.set('minQty', String(filters.minQty));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  const res = await apiRequest<{ data: PublicProduceListing[] }>(`/buyer/listings?${params.toString()}`, {
    token: session.token,
  });
  return res.data;
}

export async function toggleSaveProduceListing(
  session: AuthSession,
  listingId: string,
  currentlySaved: boolean
): Promise<void> {
  await apiRequest(`/buyer/listings/${listingId}/save`, {
    method: currentlySaved ? 'DELETE' : 'POST',
    token: session.token,
  });
}

export async function fetchBuyerRequests(session: AuthSession, status?: string): Promise<PurchaseRequestItem[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiRequest<{ data: PurchaseRequestItem[] }>(`/buyer/requests${q}`, { token: session.token });
  return res.data;
}

export async function submitBuyerRequest(
  session: AuthSession,
  payload: {
    listingId: string;
    requestType: 'enquiry' | 'purchase_request';
    requestedQuantityQuintals: number;
    offeredPriceInr: number;
    message?: string;
  }
): Promise<PurchaseRequestItem> {
  const res = await apiRequest<{ data: PurchaseRequestItem }>('/buyer/requests', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function cancelBuyerRequest(session: AuthSession, requestId: string): Promise<void> {
  await apiRequest(`/buyer/requests/${requestId}`, {
    method: 'PATCH',
    token: session.token,
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

export async function fetchBuyerOrders(session: AuthSession): Promise<PurchaseRequestItem[]> {
  const res = await apiRequest<{ data: PurchaseRequestItem[] }>('/buyer/orders', { token: session.token });
  return res.data;
}

export async function fetchIncomingFarmerRequests(session: AuthSession): Promise<PurchaseRequestItem[]> {
  if (session.mode === 'demo') return [];
  const res = await apiRequest<{ data: PurchaseRequestItem[] }>('/markets/requests/incoming', {
    token: session.token,
  });
  return res.data;
}

export async function respondToBuyerRequest(
  session: AuthSession,
  requestId: string,
  payload: { status: 'negotiating' | 'accepted' | 'rejected' | 'fulfilled'; farmerResponse?: string }
): Promise<PurchaseRequestItem> {
  const res = await apiRequest<{ data: PurchaseRequestItem }>(`/markets/requests/${requestId}/respond`, {
    method: 'PATCH',
    token: session.token,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function initializeSampleHistory(
  session: AuthSession
): Promise<{ initialized: boolean; alreadyPresent: boolean; message: string }> {
  const res = await apiRequest<{ data: { initialized: boolean; alreadyPresent: boolean; message: string } }>(
    '/farmers/me/initialize-sample-history',
    { method: 'POST', token: session.token }
  );
  return res.data;
}

export async function fetchNotifications(session: AuthSession): Promise<NotificationItem[]> {
  if (session.mode === 'demo') return [];
  const res = await apiRequest<{ data: NotificationItem[] }>('/notifications', { token: session.token });
  return res.data;
}

export async function markNotificationRead(session: AuthSession, id: string): Promise<void> {
  await apiRequest(`/notifications/${id}/read`, { method: 'PATCH', token: session.token });
}

export async function markAllNotificationsRead(session: AuthSession): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'POST', token: session.token });
}
