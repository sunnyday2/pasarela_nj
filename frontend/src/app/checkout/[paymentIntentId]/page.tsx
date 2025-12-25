/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPaymentIntent,
  listProviders,
  type PaymentIntentWithConfigResponse,
  type ProviderStatus
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
  const paymentIntentId = params.paymentIntentId;

  const [merchantApiKey, setMerchantApiKeyState] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  const [data, setData] = useState<PaymentIntentWithConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollingMsg, setPollingMsg] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);

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

  const fetchProviders = useCallback(async () => {
    if (!merchantApiKey) return;
    setProvidersError(null);
    try {
      const res = await listProviders(merchantApiKey);
      setProviderStatuses(res);
    } catch (err) {
      setProvidersError(err instanceof Error ? err.message : "Error");
    }
  }, [merchantApiKey]);

  useEffect(() => {
    if (canFetch) fetchOnce();
  }, [canFetch, fetchOnce]);

  useEffect(() => {
    if (canFetch) fetchProviders();
  }, [canFetch, fetchProviders]);

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
  const isDemo = provider === "DEMO" || demoType === "DEMO" || routingReasonCode === "DEMO_MODE";

  const providerStatus = providerStatuses.find((item) => item.provider === provider);
  const providerUnavailable = providerStatus
    ? !providerStatus.configured || !providerStatus.enabled || !providerStatus.healthy
    : false;
  const shouldShowReroute =
    status === "FAILED" ||
    status === "REQUIRES_PAYMENT_METHOD" ||
    providerUnavailable ||
    Boolean(providersError);

  useEffect(() => {
    if (!data) return;
    if (!isDemo) return;
    router.replace(`/demo-checkout/${paymentIntentId}`);
  }, [data, isDemo, paymentIntentId, router]);

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
                  <div className="pill">{provider || "-"}</div>
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

              {shouldShowReroute ? (
                <div style={{ marginTop: 12 }}>
                  <Link href={`/checkout/${paymentIntentId}/reroute`}>
                    <button className="danger">Intentar con otro proveedor</button>
                  </Link>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Elegí un proveedor disponible o dejá que AUTO decida.
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
              {provider === "STRIPE" ? (
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
              ) : isDemo ? (
                <p className="muted">Redirigiendo a demo checkout…</p>
              ) : (
                <p className="muted">Checkout no disponible. Usá el reroute para elegir otro proveedor.</p>
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
