/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  demoAuthorizePaymentIntent,
  demoCancelPaymentIntent,
  getPaymentIntent,
  reroutePaymentIntent,
  type PaymentIntentWithConfigResponse,
  type PaymentIntentView
} from "@/lib/api";
import { getMerchantApiKey, setMerchantApiKey } from "@/lib/storage";
import { StripeCheckout } from "@/components/StripeCheckout";
import { AdyenCheckout } from "@/components/AdyenCheckout";

const FINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "REFUNDED"]);
type AdyenEnv = "test" | "live" | "live-us" | "live-au" | "live-apse" | "live-in";

function normalizeAdyenEnv(v: unknown): AdyenEnv {
  const s = typeof v === "string" ? v : "test";
  switch (s) {
    case "live":
    case "live-us":
    case "live-au":
    case "live-apse":
    case "live-in":
    case "test":
      return s;
    default:
      return "test";
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ paymentIntentId: string }>();
  const searchParams = useSearchParams();
  const paymentIntentId = params.paymentIntentId;

  const [merchantApiKey, setMerchantApiKeyState] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  const [data, setData] = useState<PaymentIntentWithConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollingMsg, setPollingMsg] = useState<string | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<"approved" | "declined">("approved");
  const [demoProcessing, setDemoProcessing] = useState(false);

  const pollingStopAt = useRef<number | null>(null);

  useEffect(() => {
    const key = getMerchantApiKey() || "";
    setMerchantApiKeyState(key);
    setApiKeyInput(key);
  }, []);

  const canFetch = useMemo(() => Boolean(merchantApiKey), [merchantApiKey]);

  const fetchOnce = useCallback(async () => {
    if (!merchantApiKey) return;
    setError(null);
    try {
      const res = await getPaymentIntent(merchantApiKey, paymentIntentId);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, [merchantApiKey, paymentIntentId]);

  useEffect(() => {
    if (canFetch) fetchOnce();
  }, [canFetch, fetchOnce]);

  useEffect(() => {
    if (!canFetch) return;
    if (!data) return;
    const status = data.paymentIntent.status;
    if (FINAL_STATUSES.has(status)) return;

    let cancelled = false;
    setPolling(true);
    setPollingMsg(null);
    pollingStopAt.current = Date.now() + 90_000;

    const tick = async () => {
      if (cancelled) return;
      if (!pollingStopAt.current) return;
      if (Date.now() > pollingStopAt.current) {
        setPolling(false);
        setPollingMsg("Timeout esperando estado final. Podés refrescar o reintentar.");
        return;
      }
      await fetchOnce();
      setTimeout(tick, 2500);
    };

    const timer = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPolling(false);
    };
  }, [canFetch, data, fetchOnce]);

  async function onReroute() {
    if (!merchantApiKey) return;
    setError(null);
    try {
      const res = await reroutePaymentIntent(merchantApiKey, paymentIntentId, "USER_RETRY_OTHER_PROVIDER");
      router.push(`/checkout/${res.paymentIntentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function saveApiKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setMerchantApiKey(trimmed);
    setMerchantApiKeyState(trimmed);
  }

  const provider = data?.paymentIntent.provider;
  const status = data?.paymentIntent.status;
  const routingReasonCode = data?.paymentIntent.routingReasonCode;

  const checkoutConfig = data?.checkoutConfig || {};
  const demoType = typeof checkoutConfig.type === "string" ? checkoutConfig.type : "";
  const demoQuery = searchParams.get("demo");
  const isDemo = provider === "DEMO" || demoType === "DEMO" || demoQuery === "1";
  const demoCheckoutUrl = typeof checkoutConfig.checkoutUrl === "string" ? checkoutConfig.checkoutUrl : "";
  const providerLabel = isDemo ? "DEMO" : provider;

  function updatePaymentIntent(next: PaymentIntentView) {
    setData((prev) => (prev ? { ...prev, paymentIntent: next } : { paymentIntent: next, checkoutConfig: {} }));
  }

  async function onDemoPay() {
    if (!merchantApiKey) return;
    setError(null);
    setDemoProcessing(true);
    try {
      const res = await demoAuthorizePaymentIntent(merchantApiKey, paymentIntentId, demoOutcome);
      updatePaymentIntent(res);
      await fetchOnce();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDemoProcessing(false);
    }
  }

  async function onDemoCancel() {
    if (!merchantApiKey) return;
    setError(null);
    setDemoProcessing(true);
    try {
      const res = await demoCancelPaymentIntent(merchantApiKey, paymentIntentId);
      updatePaymentIntent(res);
      await fetchOnce();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDemoProcessing(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Checkout</h2>
          <div className="muted">
            Intent: <span className="pill">{paymentIntentId}</span>
          </div>
        </div>
        <div className="row">
          <button onClick={fetchOnce} disabled={!canFetch}>
            Refrescar
          </button>
          <Link href="/dashboard">
            <button>Volver</button>
          </Link>
        </div>
      </div>

      {!merchantApiKey ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Pegá tu <code>X-Api-Key</code> (merchant) para cargar el intent.
          </div>
          <div className="row">
            <input value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="po_demo_..." />
            <button className="primary" onClick={saveApiKey} disabled={!apiKeyInput.trim()}>
              Guardar
            </button>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="row" style={{ marginTop: 14 }}>
          <div className="col">
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="muted">Provider</div>
                  <div className="pill">{providerLabel || "-"}</div>
                </div>
                <div>
                  <div className="muted">Status</div>
                  <div className={`pill ${status === "SUCCEEDED" ? "status-success" : status === "FAILED" ? "status-failed" : ""}`}>
                    {status}
                  </div>
                </div>
                <div>
                  <div className="muted">routingReasonCode</div>
                  <div className="pill">{routingReasonCode || "-"}</div>
                </div>
              </div>

              {polling ? <p className="muted">Polling estado…</p> : null}
              {pollingMsg ? <p className="muted">{pollingMsg}</p> : null}

              {status === "FAILED" || status === "REQUIRES_PAYMENT_METHOD" ? (
                <div style={{ marginTop: 12 }}>
                  <button className="danger" onClick={onReroute}>
                    Intentar con otro proveedor
                  </button>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Nota: requiere re-tokenizar (los tokens no son portables).
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="status-failed" style={{ marginBottom: 0 }}>
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="col">
            <div className="card">
              {isDemo ? (
                <div>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="muted">Demo checkout</div>
                      <div className="pill">Pasarela simulada</div>
                    </div>
                    <div className="muted">{demoCheckoutUrl ? "checkoutUrl disponible" : "modo embebido"}</div>
                  </div>

                  <div style={{ height: 12 }} />

                  <div className="row">
                    {["Seleccionar método", "Autenticación", "Autorización", "Resultado"].map((step, idx) => (
                      <span key={step} className="pill" style={{ fontSize: 11 }}>
                        {idx + 1}. {step}
                      </span>
                    ))}
                  </div>

                  <div style={{ height: 14 }} />

                  <div className="card" style={{ background: "rgba(0,0,0,0.18)" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div className="muted">Comercio</div>
                        <div>{data.paymentIntent.merchantId}</div>
                      </div>
                      <div>
                        <div className="muted">Importe</div>
                        <div>
                          {data.paymentIntent.currency} {data.paymentIntent.amountMinor / 100}
                        </div>
                      </div>
                      <div>
                        <div className="muted">Intent</div>
                        <div>{data.paymentIntent.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 12 }} />

                  <label className="label">Número de tarjeta</label>
                  <input placeholder="4242 4242 4242 4242" />

                  <div className="row">
                    <div className="col">
                      <label className="label">Expiración (MM/YY)</label>
                      <input placeholder="12/29" />
                    </div>
                    <div className="col">
                      <label className="label">CVV</label>
                      <input placeholder="123" />
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <label className="label">Resultado simulado</label>
                  <select value={demoOutcome} onChange={(e) => setDemoOutcome(e.target.value as "approved" | "declined")}>
                    <option value="approved">Aprobado</option>
                    <option value="declined">Rechazado</option>
                  </select>

                  <div style={{ height: 12 }} />

                  <div className="row">
                    <button className="primary" onClick={onDemoPay} disabled={demoProcessing || !merchantApiKey}>
                      {demoProcessing ? "Procesando..." : "PAGAR"}
                    </button>
                    <button className="danger" onClick={onDemoCancel} disabled={demoProcessing || !merchantApiKey}>
                      CANCELAR
                    </button>
                  </div>

                  {demoCheckoutUrl ? (
                    <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
                      También podés abrir el checkout externo demo:{" "}
                      <a href={demoCheckoutUrl} target="_blank" rel="noreferrer">
                        {demoCheckoutUrl}
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : provider === "STRIPE" ? (
                <StripeCheckout
                  publishableKey={String(checkoutConfig.publishableKey || "")}
                  clientSecret={String(checkoutConfig.clientSecret || "")}
                />
              ) : provider === "ADYEN" ? (
                <AdyenCheckout
                  clientKey={String(checkoutConfig.clientKey || "")}
                  environment={normalizeAdyenEnv(checkoutConfig.environment)}
                  sessionId={String(checkoutConfig.sessionId || "")}
                  sessionData={String(checkoutConfig.sessionData || "")}
                />
              ) : (
                <p className="muted">Cargando checkout...</p>
              )}
            </div>
          </div>
        </div>
      ) : canFetch ? (
        <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
          Cargando...
        </p>
      ) : null}
    </div>
  );
}
