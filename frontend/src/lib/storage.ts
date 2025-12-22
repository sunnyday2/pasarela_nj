/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const KEY_JWT = "po.jwt";
const KEY_MERCHANT_API_KEY = "po.merchantApiKey";

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_JWT);
}

export function setJwt(token: string) {
  window.localStorage.setItem(KEY_JWT, token);
}

export function clearJwt() {
  window.localStorage.removeItem(KEY_JWT);
}

export function getMerchantApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_MERCHANT_API_KEY);
}

export function setMerchantApiKey(apiKey: string) {
  window.localStorage.setItem(KEY_MERCHANT_API_KEY, apiKey);
}

export function clearMerchantApiKey() {
  window.localStorage.removeItem(KEY_MERCHANT_API_KEY);
}

