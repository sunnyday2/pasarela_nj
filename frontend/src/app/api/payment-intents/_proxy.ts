/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const BACKEND_BASE_URL = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(
  /\/$/,
  ""
);

const FORWARDED_HEADERS = ["authorization", "content-type", "x-api-key", "idempotency-key", "x-request-id", "accept"];

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const key of FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

function responseWithHeaders(res: Response, body: string | ReadableStream<Uint8Array> | null) {
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status: res.status, headers });
}

function logProxyError(method: string, path: string, status: number, body: string) {
  let requestId = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as { requestId?: string; message?: string };
    requestId = parsed.requestId || "";
    message = parsed.message || "";
  } catch {}

  const safeMessage = message ? ` message=${message}` : "";
  const safeRequestId = requestId ? ` requestId=${requestId}` : "";
  console.error(`[api/payment-intents] ${method} ${path} -> ${status}${safeRequestId}${safeMessage}`);
}

export async function proxyPaymentIntents(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = `${BACKEND_BASE_URL}${url.pathname}${url.search}`;
  const method = request.method.toUpperCase();

  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const res = await fetch(target, {
    method,
    headers: buildForwardHeaders(request),
    body
  });

  if (res.ok) {
    return responseWithHeaders(res, res.body);
  }

  const text = await res.text();
  logProxyError(method, url.pathname, res.status, text);
  return responseWithHeaders(res, text);
}
