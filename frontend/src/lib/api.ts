/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type ProviderPreference = "AUTO" | "STRIPE" | "ADYEN" | "MASTERCARD" | "DEMO" | "PAYPAL";
export type PaymentProvider = "STRIPE" | "ADYEN" | "MASTERCARD" | "DEMO" | "PAYPAL";
export type PaymentStatus =
  | "CREATED"
  | "REQUIRES_PAYMENT_METHOD"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED";

export type MerchantDto = {
  id: string;
  name: string;
  configJson: string;
  createdAt: string;
};

export type ProviderConfigView = {
  provider: PaymentProvider;
  enabled: boolean;
  configured: boolean;
  config: Record<string, string>;
  missingFields?: string[];
  configurable: boolean;
};

export type ProviderConfigRequest = {
  enabled?: boolean;
  config?: Record<string, string>;
};

export type ProviderStatus = {
  provider: PaymentProvider;
  configured: boolean;
  enabled: boolean;
  healthy: boolean;
  reason?: string | null;
};

export type CreateMerchantResponse = {
  merchant: MerchantDto;
  apiKey: string;
};

export type PaymentIntentView = {
  id: string;
  merchantId: string;
  amountMinor: number;
  currency: string;
  description?: string | null;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRef?: string | null;
  idempotencyKey?: string | null;
  routingDecisionId?: string | null;
  routingReasonCode?: string | null;
  rootPaymentIntentId?: string | null;
  attemptNumber?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentIntentCreateResponse = {
  paymentIntentId: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  routingDecisionId?: string | null;
  routingReasonCode?: string | null;
  checkoutConfig: Record<string, unknown>;
};

export type PaymentIntentWithConfigResponse = {
  paymentIntent: PaymentIntentView;
  checkoutConfig: Record<string, unknown>;
};

const API_BASE_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
})();

async function apiFetch(path: string, init: RequestInit = {}) {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export async function register(email: string, password: string) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }) as Promise<{ token: string }>;
}

export async function login(email: string, password: string) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }) as Promise<{ token: string }>;
}

export async function listMerchants(jwt: string) {
  return apiFetch("/api/merchants", {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<MerchantDto[]>;
}

export async function createMerchant(jwt: string, name: string) {
  return apiFetch("/api/merchants", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ name })
  }) as Promise<CreateMerchantResponse>;
}

export async function listMerchantProviders(jwt: string, merchantId: string) {
  return apiFetch(`/api/merchants/${encodeURIComponent(merchantId)}/providers`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<ProviderConfigView[]>;
}

export async function upsertMerchantProvider(
  jwt: string,
  merchantId: string,
  provider: PaymentProvider,
  req: ProviderConfigRequest
) {
  return apiFetch(`/api/merchants/${encodeURIComponent(merchantId)}/providers/${provider}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(req)
  }) as Promise<ProviderConfigView>;
}

export async function disableMerchantProvider(jwt: string, merchantId: string, provider: PaymentProvider) {
  return apiFetch(`/api/merchants/${encodeURIComponent(merchantId)}/providers/${provider}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<ProviderConfigView>;
}

export async function listProviderStatuses(jwt: string) {
  return apiFetch("/api/providers", {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<ProviderStatus[]>;
}

export async function getProviderConfig(jwt: string, provider: PaymentProvider) {
  return apiFetch(`/api/providers/${provider}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<ProviderConfigView>;
}

export async function upsertProviderConfig(jwt: string, provider: PaymentProvider, req: ProviderConfigRequest) {
  return apiFetch(`/api/providers/${provider}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(req)
  }) as Promise<ProviderConfigView>;
}

export async function disableProviderConfig(jwt: string, provider: PaymentProvider) {
  return apiFetch(`/api/providers/${provider}/disable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` }
  }) as Promise<ProviderConfigView>;
}

export async function listPaymentIntents(merchantApiKey: string) {
  return apiFetch("/api/payment-intents", {
    method: "GET",
    headers: { "X-Api-Key": merchantApiKey }
  }) as Promise<PaymentIntentView[]>;
}

export async function listProviders(merchantApiKey: string) {
  return apiFetch("/api/providers", {
    method: "GET",
    headers: { "X-Api-Key": merchantApiKey }
  }) as Promise<ProviderStatus[]>;
}

export async function createPaymentIntent(
  merchantApiKey: string,
  req: { amountMinor: number; currency: string; description?: string; providerPreference: ProviderPreference },
  idempotencyKey?: string
) {
  return apiFetch("/api/payment-intents", {
    method: "POST",
    headers: {
      "X-Api-Key": merchantApiKey,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify(req)
  }) as Promise<PaymentIntentCreateResponse>;
}

export async function getPaymentIntent(merchantApiKey: string, id: string) {
  return apiFetch(`/api/payment-intents/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { "X-Api-Key": merchantApiKey }
  }) as Promise<PaymentIntentWithConfigResponse>;
}

export async function reroutePaymentIntent(
  merchantApiKey: string,
  id: string,
  reason: string,
  provider?: PaymentProvider
) {
  return apiFetch(`/api/payment-intents/${encodeURIComponent(id)}/reroute`, {
    method: "POST",
    headers: { "X-Api-Key": merchantApiKey },
    body: JSON.stringify({ reason, provider })
  }) as Promise<PaymentIntentCreateResponse>;
}

export type DemoCardInput = {
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
};

export async function demoAuthorizePaymentIntent(merchantApiKey: string, id: string, card?: DemoCardInput) {
  return apiFetch(`/api/payment-intents/${encodeURIComponent(id)}/demo/authorize`, {
    method: "POST",
    headers: { "X-Api-Key": merchantApiKey },
    body: JSON.stringify(card || {})
  }) as Promise<PaymentIntentView>;
}

export async function demoCancelPaymentIntent(merchantApiKey: string, id: string) {
  return apiFetch(`/api/payment-intents/${encodeURIComponent(id)}/demo/cancel`, {
    method: "POST",
    headers: { "X-Api-Key": merchantApiKey }
  }) as Promise<PaymentIntentView>;
}
