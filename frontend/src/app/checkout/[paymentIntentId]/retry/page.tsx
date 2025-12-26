/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPaymentIntent,
  listProviders,
  reroutePaymentIntent,
  type PaymentIntentWithConfigResponse,
  type PaymentProvider,
  type ProviderStatus
} from "@/lib/api";
import { getMerchantApiKey, setMerchantApiKey } from "@/lib/storage";

const ALL_PROVIDERS: (PaymentProvider | "AUTO")[] = ["AUTO", "STRIPE", "ADYEN", "MASTERCARD", "DEMO", "PAYPAL"];

function statusLabel(status?: ProviderStatus) {
  if (!status) return "Desconocido";
  if (!status.configured) return "No configurado";
  if (!status.enabled) return "Deshabilitado";
  if (!status.healthy) return "No saludable";
  return "Disponible";
}

function statusHint(status?: ProviderStatus) {
  if (!status?.reason) return "";
  switch (status.reason) {
    case "NOT_IMPLEMENTED":
      return "Próximamente";
    case "NOT_CONFIGURED":
      return "Configurar credenciales";
    case "DISABLED":
      return "Deshabilitado";
    case "UNHEALTHY":
      return "No saludable";
    default:
      if (status.reason.startsWith("MISSING_FIELDS:")) {
        return `Faltan ${status.reason.replace("MISSING_FIELDS:", "")}`;
      }
      return status.reason;
  }
}

function isSelectable(status?: ProviderStatus) {
  if (!status) return false;
  if (status.provider === "DEMO") return true;
  return status.configured && status.enabled && status.healthy;
}

export default function RetryPage() {
  const router = useRouter();
  const params = useParams<{ paymentIntentId: string }>();
  const paymentIntentId = params.paymentIntentId;

  const [merchantApiKey, setMerchantApiKeyState] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [data, setData] = useState<PaymentIntentWithConfigResponse | null>(null);
  const [selection, setSelection] = useState<PaymentProvider | "AUTO">("AUTO");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = getMerchantApiKey() || "";
    setMerchantApiKeyState(key);
    setApiKeyInput(key);
  }, []);

  const canFetch = useMemo(() => Boolean(merchantApiKey), [merchantApiKey]);

  const fetchProviders = useCallback(async () => {
    if (!merchantApiKey) return;
    try {
      const res = await listProviders(merchantApiKey);
      setProviders(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, [merchantApiKey]);

  const fetchIntent = useCallback(async () => {
    if (!merchantApiKey) return;
    try {
      const res = await getPaymentIntent(merchantApiKey, paymentIntentId);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, [merchantApiKey, paymentIntentId]);

  useEffect(() => {
    if (!canFetch) return;
    fetchProviders();
    fetchIntent();
  }, [canFetch, fetchIntent, fetchProviders]);

  function saveApiKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setMerchantApiKey(trimmed);
    setMerchantApiKeyState(trimmed);
  }

  async function onConfirm() {
    if (!merchantApiKey) return;
    setError(null);
    setLoading(true);
    try {
      const provider = selection === "AUTO" ? undefined : selection;
      const res = await reroutePaymentIntent(merchantApiKey, paymentIntentId, "USER_RETRY", provider);
      const isDemo = res.provider === "DEMO" || res.routingReasonCode === "DEMO_MODE";
      router.push(isDemo ? `/demo-checkout/${res.paymentIntentId}` : `/checkout/${res.paymentIntentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const currentProvider = data?.paymentIntent.provider;
  const currentStatus = data?.paymentIntent.status;

  return (
    <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Reintentar · Elegir proveedor</h2>
          <div className="muted">
            Intent: <span className="pill">{paymentIntentId}</span>
          </div>
        </div>
        <div className="row">
          <Link href={`/checkout/${paymentIntentId}`}>
            <button>Volver</button>
          </Link>
        </div>
      </div>

      {!merchantApiKey ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Pegá tu <code>X-Api-Key</code> (merchant) para continuar.
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
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="muted">Proveedor actual</div>
              <div className="pill">{currentProvider}</div>
            </div>
            <div>
              <div className="muted">Status</div>
              <div className={`pill ${currentStatus === "FAILED" ? "status-failed" : currentStatus === "SUCCEEDED" ? "status-success" : ""}`}>
                {currentStatus}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ height: 12 }} />

      <label className="label">Nuevo proveedor</label>
      <select value={selection} onChange={(e) => setSelection(e.target.value as PaymentProvider | "AUTO")}>
        {ALL_PROVIDERS.map((provider) => {
          if (provider === "AUTO") return <option key={provider} value={provider}>AUTO (recomendado)</option>;
          const status = providers.find((item) => item.provider === provider);
          const selectable = isSelectable(status);
          const hint = statusHint(status);
          return (
            <option key={provider} value={provider} disabled={!selectable}>
              {provider} {selectable ? "" : `· ${hint || statusLabel(status)}`}
            </option>
          );
        })}
      </select>

      <div style={{ height: 12 }} />

      <div className="card" style={{ background: "rgba(0,0,0,0.18)" }}>
        <div className="muted" style={{ marginBottom: 8 }}>
          Estado de proveedores
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {providers.map((provider) => (
            <span key={provider.provider} className="pill" style={{ fontSize: 12 }}>
              {provider.provider}: {statusLabel(provider)}
            </span>
          ))}
          {!providers.length ? <span className="muted">Sin datos de proveedores.</span> : null}
        </div>
      </div>

      {error ? (
        <p className="status-failed" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}

      <div style={{ height: 14 }} />

      <div className="row">
        <button className="primary" onClick={onConfirm} disabled={!merchantApiKey || loading}>
          {loading ? "Reintentando..." : "Confirmar reintento"}
        </button>
        <Link href={`/checkout/${paymentIntentId}`}>
          <button disabled={loading}>Cancelar</button>
        </Link>
      </div>
    </div>
  );
}
