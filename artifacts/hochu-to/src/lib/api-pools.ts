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

export function getPool(id: number): Promise<PoolDetail> {
  return jsonFetch<PoolDetail>(`/api/pools/${id}`);
}

export interface CreatePoolPayload {
  title: string;
  description?: string | null;
  itemUrl?: string | null;
  targetAmountRub: number;
  creatorPaymentDetails: string;
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
