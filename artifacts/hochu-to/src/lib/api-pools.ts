import { getAuthHeaders } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Stage 23b — Co-Sharing API client (тонкая обёртка над fetch).
 *
 * Не используем generated orval-клиент, т.к. эндпоинты ещё не в OpenAPI-spec.
 * Когда стабилизируется — перенесём на api-client-react.
 */

export type PoolStatus = "funding" | "purchasing" | "active" | "liquidated" | "canceled";
export type PoolPaymentStatus = "pending" | "user_transferred" | "creator_confirmed" | "escrow_held";

export interface PoolListItem {
  id: number;
  title: string;
  description: string | null;
  itemUrl: string | null;
  targetAmountRub: number;
  collectionMethod: "p2p_direct" | "platform_escrow";
  procurementStrategy: "self_managed" | "platform_concierge";
  status: PoolStatus;
  creatorId: number;
  createdAt: string;
  expiresAt: string | null;
  collectedAmountRub: number;
}

export interface PoolShareDetail {
  id: number;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  sharePercentage: string;
  amountRub: number;
  paymentStatus: PoolPaymentStatus;
  createdAt: string;
}

export interface PoolLinkedListing {
  id: number;
  wearAndTearMeter: number;
  pricePerDay: string;
  isAvailable: boolean;
  custodianId: number | null;
}

export type ShareOfferStatus = "open" | "sold" | "canceled";

export interface ShareOfferDetail {
  id: number;
  shareId: number;
  sellerId: number;
  sellerName: string;
  sellerAvatarUrl: string | null;
  priceRub: number;
  status: ShareOfferStatus;
  /** Процент доли (numeric строка из БД, например "12.50"). */
  sharePercentage: string;
  /** Изначальная сумма доли в рублях. */
  amountRub: number;
  /** Stage 25: id зарезервировавшего покупателя; null = свободно. */
  buyerId: number | null;
  reservedAt: string | null;
  createdAt: string;
}

export interface PoolDetail extends PoolListItem {
  description: string | null;
  creatorPaymentDetails: string | null;
  actualPurchasePriceRub: number | null;
  maintenanceFundBalance: number;
  protectionMode: boolean;
  creator: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
  /** Stage 26: связанный listing (присутствует только для активированных пулов). */
  listing: PoolLinkedListing | null;
  shares: PoolShareDetail[];
  /** Stage 25: открытые офферы вторичного рынка для этого пула. */
  offers: ShareOfferDetail[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: "invalid_json", raw: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`) as Error & {
      status?: number;
      data?: any;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function listPools(status: PoolStatus = "funding"): Promise<PoolListItem[]> {
  return jsonFetch<PoolListItem[]>(`/api/pools?status=${encodeURIComponent(status)}`);
}

export interface MyPoolItem {
  id: number;
  title: string;
  status: PoolStatus;
  targetAmountRub: number;
  collectedAmountRub: number;
  creatorId: number;
  createdAt: string;
  expiresAt: string | null;
  maintenanceFundBalance: number;
  isCreator: boolean;
  myShare: {
    shareId: number;
    sharePercentage: string;
    amountRub: number;
    paymentStatus: PoolPaymentStatus;
  } | null;
}

export function getMyPools(): Promise<MyPoolItem[]> {
  return jsonFetch<MyPoolItem[]>("/api/pools/mine");
}

export function getPool(id: number): Promise<PoolDetail> {
  return jsonFetch<PoolDetail>(`/api/pools/${id}`);
}

export interface PoolIncomeDistribution {
  userId: number;
  userName: string | null;
  amount: number;
  description: string | null;
}

export interface PoolIncomeEntry {
  bookingId: number;
  bookingNumber: string | null;
  date: string;
  distributions: PoolIncomeDistribution[];
  maintenanceCut: number;
  total: number;
}

export interface PoolIncomeResponse {
  entries: PoolIncomeEntry[];
  totalDistributed: number;
  maintenanceTotal: number;
  maintenanceFundBalance: number;
}

export function getPoolIncome(poolId: number): Promise<PoolIncomeResponse> {
  return jsonFetch<PoolIncomeResponse>(`/api/pools/${poolId}/income`);
}

export interface CreatePoolPayload {
  title: string;
  description?: string | null;
  itemUrl?: string | null;
  targetAmountRub: number;
  creatorPaymentDetails: string;
  expiresAt?: string | null;
}

export function createPool(body: CreatePoolPayload): Promise<PoolListItem> {
  return jsonFetch<PoolListItem>("/api/pools", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function contributeShare(poolId: number, amountRub: number): Promise<PoolShareDetail> {
  return jsonFetch<PoolShareDetail>(`/api/pools/${poolId}/shares`, {
    method: "POST",
    body: JSON.stringify({ amountRub }),
  });
}

export function confirmShare(poolId: number, shareId: number) {
  return jsonFetch<{ share: PoolShareDetail; collected: number; pool: PoolDetail }>(
    `/api/pools/${poolId}/shares/${shareId}/confirm`,
    { method: "POST" },
  );
}

// ── Stage 25: Secondary market ────────────────────────────────────────────

export interface CreateOfferPayload {
  priceRub: number;
  sellerPaymentDetails: string;
}

export function createShareOffer(
  poolId: number,
  shareId: number,
  body: CreateOfferPayload,
): Promise<ShareOfferDetail> {
  return jsonFetch<ShareOfferDetail>(`/api/pools/${poolId}/shares/${shareId}/offers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listOffers(poolId: number): Promise<ShareOfferDetail[]> {
  return jsonFetch<ShareOfferDetail[]>(`/api/pools/${poolId}/offers`);
}

export interface BuyOfferResponse {
  offer: ShareOfferDetail;
  sellerPaymentDetails: string | null;
  instructions: string;
}

export function buyShareOffer(poolId: number, offerId: number): Promise<BuyOfferResponse> {
  return jsonFetch<BuyOfferResponse>(`/api/pools/${poolId}/offers/${offerId}/buy`, {
    method: "POST",
  });
}

export interface ConfirmTransferResponse {
  offer: ShareOfferDetail;
  share: PoolShareDetail;
  mergeMode: "merge" | "transfer";
}

export function confirmShareTransfer(
  poolId: number,
  offerId: number,
): Promise<ConfirmTransferResponse> {
  return jsonFetch<ConfirmTransferResponse>(
    `/api/pools/${poolId}/offers/${offerId}/confirm-transfer`,
    { method: "POST" },
  );
}

export function cancelShareOffer(poolId: number, offerId: number): Promise<{ offer: ShareOfferDetail }> {
  return jsonFetch<{ offer: ShareOfferDetail }>(`/api/pools/${poolId}/offers/${offerId}/cancel`, {
    method: "POST",
  });
}

// ── Stage 26-B: Suggested price (server-side mirror of pricing.ts) ────────

export interface SuggestedPriceResponse {
  poolId: number;
  shareId: number;
  shareInitialRub: number;
  sharePct: number;
  wearAndTearMeter: number;
  depreciationPerRentalPercent: number;
  depreciationPercent: number;
  residualRatio: number;
  suggestedRub: number;
  currency: "RUB";
}

export function getSuggestedPrice(
  poolId: number,
  shareId: number,
): Promise<SuggestedPriceResponse> {
  return jsonFetch<SuggestedPriceResponse>(
    `/api/pools/${poolId}/shares/${shareId}/suggested-price`,
  );
}

// ── Stage 26-B: Pool custodian handover ───────────────────────────────────

export interface HandoverPoolPayload {
  toUserId: number;
  photos: string[];
  videoUrl?: string | null;
  metadata: {
    signature: string;
    location?: { latitude: number; longitude: number; accuracy?: number } | null;
    notes?: string;
    [k: string]: unknown;
  };
}

export interface HandoverPoolResponse {
  act: {
    id: number;
    poolId: number;
    type: "pool_handover";
    photos: string[];
    videoUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  };
  listingId: number;
  fromUserId: number;
  toUserId: number;
  message: string;
}

export function handoverPool(
  poolId: number,
  body: HandoverPoolPayload,
): Promise<HandoverPoolResponse> {
  return jsonFetch<HandoverPoolResponse>(`/api/pools/${poolId}/handovers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Stage 27: Audit timeline ──────────────────────────────────────────────

export type PoolEventType =
  | "pool_created"
  | "share_contributed"
  | "share_confirmed"
  | "pool_purchasing"
  | "offer_created"
  | "offer_reserved"
  | "share_transferred"
  | "offer_canceled"
  // Stage 26-B
  | "fund_accrued"
  | "custodian_changed";

export interface PoolEvent {
  id: number;
  eventType: PoolEventType | string;
  actorId: number | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export function listPoolEvents(poolId: number): Promise<PoolEvent[]> {
  return jsonFetch<PoolEvent[]>(`/api/pools/${poolId}/events`);
}

// ── Stage 28: Полный выкуп пула ─────────────────────────────────────────────

export type BuyoutStatus = "pending" | "completed" | "canceled";
export type BuyoutParticipantStatus = "pending_approval" | "user_transferred" | "confirmed";

export interface BuyoutRequest {
  id: number;
  poolId: number;
  initiatorId: number;
  status: BuyoutStatus;
  createdAt: string;
  initiatorName: string | null;
  initiatorPaymentDetails: string | null;
}

export interface BuyoutParticipant {
  id: number;
  userId: number;
  userName: string | null;
  shareId: number | null;
  sharePercentage: string;
  shareAmountRub: number;
  priceRub: number;
  status: BuyoutParticipantStatus;
  createdAt: string;
}

export interface BuyoutDetailResponse {
  buyoutRequest: BuyoutRequest | null;
  participants: BuyoutParticipant[];
}

export interface CreateBuyoutResponse {
  buyoutRequest: BuyoutRequest;
  participants: BuyoutParticipant[];
  summary: {
    residualRatio: number;
    totalPayoutRub: number;
    participantsCount: number;
    targetAmountRub: number;
  };
}

export function getPoolBuyout(poolId: number): Promise<BuyoutDetailResponse> {
  return jsonFetch<BuyoutDetailResponse>(`/api/pools/${poolId}/buyout`);
}

export function createPoolBuyout(poolId: number): Promise<CreateBuyoutResponse> {
  return jsonFetch<CreateBuyoutResponse>(`/api/pools/${poolId}/buyout`, {
    method: "POST",
  });
}

export function markBuyoutTransferred(
  requestId: number,
  participantId: number,
): Promise<{ participant: BuyoutParticipant }> {
  return jsonFetch<{ participant: BuyoutParticipant }>(
    `/api/buyouts/${requestId}/participants/${participantId}/mark-transferred`,
    { method: "POST" },
  );
}

export function confirmBuyoutParticipant(
  requestId: number,
  participantId: number,
): Promise<{
  participant: BuyoutParticipant;
  initiatorShare: { sharePercentage: string; amountRub: number };
  poolLiquidated: boolean;
  listing: { id: number } | null;
}> {
  return jsonFetch(`/api/buyouts/${requestId}/participants/${participantId}/confirm`, {
    method: "POST",
  });
}

export function cancelBuyout(requestId: number): Promise<{ buyoutRequest: BuyoutRequest }> {
  return jsonFetch<{ buyoutRequest: BuyoutRequest }>(
    `/api/buyouts/${requestId}/cancel`,
    { method: "POST" },
  );
}
