/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPaymentIntent, type ProviderPreference } from "@/lib/api";
import { getMerchantApiKey } from "@/lib/storage";

export default function NewPaymentPage() {
  const router = useRouter();
  const [merchantApiKey, setMerchantApiKey] = useState<string>("");
  const [amountMajor, setAmountMajor] = useState<string>("10.00");
  const [currency, setCurrency] = useState<string>("EUR");
  const [description, setDescription] = useState<string>("Demo checkout embebido");
  const [providerPreference, setProviderPreference] = useState<ProviderPreference>("AUTO");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMerchantApiKey(getMerchantApiKey() || "");
  }, []);

  const amountMinor = useMemo(() => {
    const v = Number(amountMajor);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v * 100);
  }, [amountMajor]);

  async function onCreate() {
    setError(null);
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await createPaymentIntent(
        merchantApiKey,
        { amountMinor, currency: currency.toUpperCase(), description, providerPreference },
        idempotencyKey
      );
      router.push(`/checkout/${res.paymentIntentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Nuevo Payment Intent</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Pre-routing: el backend decide proveedor antes de emitir <code>checkoutConfig</code>.
      </p>

      {!merchantApiKey ? (
        <p className="status-failed">
          Falta <code>X-Api-Key</code>. Seleccioná un merchant en <a href="/dashboard">/dashboard</a>.
        </p>
      ) : null}

      <div className="row">
        <div className="col">
          <label className="label">Monto (major)</label>
          <input value={amountMajor} onChange={(e) => setAmountMajor(e.target.value)} inputMode="decimal" />
          <div className="muted" style={{ marginTop: 6 }}>
            amountMinor: <span className="pill">{amountMinor}</span>
          </div>
        </div>
        <div className="col">
          <label className="label">Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="MXN">MXN</option>
          </select>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <label className="label">Descripción</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} />

      <div style={{ height: 10 }} />

      <label className="label">Provider preference</label>
      <select value={providerPreference} onChange={(e) => setProviderPreference(e.target.value as ProviderPreference)}>
        <option value="AUTO">AUTO</option>
        <option value="STRIPE">STRIPE</option>
        <option value="ADYEN">ADYEN</option>
      </select>

      {error ? (
        <p className="status-failed" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}

      <div style={{ height: 14 }} />

      <div className="row">
        <button className="primary" onClick={onCreate} disabled={!merchantApiKey || amountMinor <= 0 || loading}>
          {loading ? "Creando..." : "Crear y abrir checkout"}
        </button>
        <button onClick={() => router.push("/dashboard")} disabled={loading}>
          Volver
        </button>
      </div>
    </div>
  );
}

