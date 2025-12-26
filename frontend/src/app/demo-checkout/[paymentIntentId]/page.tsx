/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  demoAuthorizePaymentIntent,
  demoCancelPaymentIntent,
  getPaymentIntent,
  type PaymentIntentWithConfigResponse,
  type PaymentIntentView
} from "@/lib/api";
import { getMerchantApiKey, setMerchantApiKey } from "@/lib/storage";

const FINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "REFUNDED"]);

export default function DemoCheckoutPage() {
  const params = useParams<{ paymentIntentId: string }>();
  const paymentIntentId = params.paymentIntentId;

  const [merchantApiKey, setMerchantApiKeyState] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  const [data, setData] = useState<PaymentIntentWithConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollingMsg, setPollingMsg] = useState<string | null>(null);
  const [demoProcessing, setDemoProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");

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

  function saveApiKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setMerchantApiKey(trimmed);
    setMerchantApiKeyState(trimmed);
  }

  function updatePaymentIntent(next: PaymentIntentView) {
    setData((prev) => (prev ? { ...prev, paymentIntent: next } : { paymentIntent: next, checkoutConfig: {} }));
  }

  async function onDemoPay() {
    if (!merchantApiKey) return;
    setError(null);
    setDemoProcessing(true);
    try {
      const res = await demoAuthorizePaymentIntent(merchantApiKey, paymentIntentId, {
        cardNumber,
        expMonth,
        expYear,
        cvv
      });
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

  const paymentIntent = data?.paymentIntent;
  const status = paymentIntent?.status;
  const checkoutConfig = data?.checkoutConfig || {};
  const demoCheckoutUrl = typeof checkoutConfig.checkoutUrl === "string" ? checkoutConfig.checkoutUrl : "";

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Pasarela Orchestrator – Demo checkout</h2>
          <div className="muted">
            Pasarela simulada · Intent: <span className="pill">{paymentIntentId}</span>
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
                  <div className="pill">DEMO</div>
                </div>
                <div>
                  <div className="muted">Status</div>
                  <div className={`pill ${status === "SUCCEEDED" ? "status-success" : status === "FAILED" ? "status-failed" : ""}`}>
                    {status}
                  </div>
                </div>
                <div>
                  <div className="muted">routingReasonCode</div>
                  <div className="pill">{paymentIntent?.routingReasonCode || "-"}</div>
                </div>
              </div>

              {polling ? <p className="muted">Polling estado…</p> : null}
              {pollingMsg ? <p className="muted">{pollingMsg}</p> : null}

              {status === "FAILED" ? (
                <div style={{ marginTop: 12 }}>
                  <Link href={`/checkout/${paymentIntentId}/retry`}>
                    <button className="danger">Intentar con otro proveedor</button>
                  </Link>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    El reintento crea un nuevo intent y checkout.
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
                    <div>{paymentIntent?.merchantId}</div>
                  </div>
                  <div>
                    <div className="muted">Importe</div>
                    <div>
                      {paymentIntent?.currency} {paymentIntent ? paymentIntent.amountMinor / 100 : ""}
                    </div>
                  </div>
                  <div>
                    <div className="muted">Intent</div>
                    <div>{paymentIntent ? `${paymentIntent.id.slice(0, 8)}…` : "-"}</div>
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <label className="label">Número de tarjeta</label>
              <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" />

              <div className="row">
                <div className="col">
                  <label className="label">Expiración (MM/YY)</label>
                  <input
                    value={`${expMonth}${expYear ? `/${expYear}` : ""}`}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\s/g, "");
                      const parts = raw.split("/");
                      setExpMonth(parts[0]?.slice(0, 2) || "");
                      setExpYear(parts[1]?.slice(0, 2) || "");
                    }}
                    placeholder="12/29"
                  />
                </div>
                <div className="col">
                  <label className="label">CVV</label>
                  <input value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" />
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div className="muted">Regla demo: CVV 000 =&gt; rechazado.</div>

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
