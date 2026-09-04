/**
 * Typed API client.
 *
 * Same-origin `/api` -- the server that serves this bundle also serves the
 * API, which is what makes tunnelling work. Never reintroduce an absolute
 * host here; that is precisely the v2 defect being fixed.
 */
import type { WireMaterial, WireProduct, Settings, FeeRecord } from "@shared/types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // Session cookie must ride along; it is httpOnly so JS never sees it.
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: string[] | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: string[] };
      if (body.error) message = body.error;
      details = body.details;
    } catch {
      /* non-JSON error body; keep the status-based message */
    }
    throw new ApiError(message, res.status, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body: unknown) =>
  request<T>(p, { method: "POST", body: JSON.stringify(body) });
const put = <T>(p: string, body: unknown) =>
  request<T>(p, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(p: string) => request<T>(p, { method: "DELETE" });

export interface HealthResponse {
  status: "ok" | "degraded";
  db: string;
  latencyMs: number;
}

export interface CurrentUser {
  email: string;
  mode: "local" | "tunnel";
  trustedLocal: boolean;
  passwordConfigured: boolean;
}

export const api = {
  health: () => get<HealthResponse>("/health"),

  auth: {
    me: () => get<{ user: CurrentUser }>("/auth/me"),
    login: (password: string) => post<{ user: CurrentUser }>("/auth/login", { password }),
    logout: () => post<{ message: string }>("/auth/logout", {}),
    signOutEverywhere: () => post<{ message: string }>("/auth/sign-out-everywhere", {}),
  },

  materials: {
    list: () => get<WireMaterial[]>("/materials"),
    common: () => get<WireMaterial[]>("/materials/common"),
    create: (body: Partial<WireMaterial>) => post<WireMaterial>("/materials", body),
    update: (id: string, body: Partial<WireMaterial>) => put<WireMaterial>(`/materials/${id}`, body),
    remove: (id: string) => del<{ message: string }>(`/materials/${id}`),
    replaceAll: (items: Partial<WireMaterial>[]) =>
      post<{ created: number; deleted: number }>("/materials/bulk", items),
  },

  products: {
    list: () => get<WireProduct[]>("/products"),
    get: (id: string) => get<WireProduct>(`/products/${id}`),
    save: (body: Partial<WireProduct>) => post<WireProduct>("/products", body),
    update: (id: string, body: Partial<WireProduct>) => put<WireProduct>(`/products/${id}`, body),
    remove: (id: string) => del<{ message: string }>(`/products/${id}`),
    replaceAll: (items: Partial<WireProduct>[]) =>
      post<{ created: number; deleted: number }>("/products/bulk", items),
  },

  settings: {
    get: () => get<{ settings: Settings; fees: FeeRecord[] }>("/settings"),
    update: (body: Partial<Settings>) => put<Settings>("/settings", body),
    saveFee: (body: Partial<FeeRecord> & { label: string }) =>
      post<FeeRecord>("/settings/fees", body),
    deleteFee: (id: string) => del<{ message: string }>(`/settings/fees/${id}`),
  },

  backup: {
    dump: () => get<Record<string, unknown>>("/backup"),
    restore: (bundle: unknown) =>
      post<{ materials: number; products: number }>("/backup/restore", bundle),
  },
};
