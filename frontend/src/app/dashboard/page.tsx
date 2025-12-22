/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createMerchant, listMerchants, listPaymentIntents, type MerchantDto, type PaymentIntentView } from "@/lib/api";
import { clearJwt, getJwt, getMerchantApiKey, setMerchantApiKey } from "@/lib/storage";

function formatAmount(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(major);
}

export default function DashboardPage() {
  const router = useRouter();
  const [jwt, setJwtState] = useState<string | null>(null);
  const [merchantApiKey, setMerchantApiKeyState] = useState<string>("");

  const [merchants, setMerchants] = useState<MerchantDto[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntentView[]>([]);

  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newMerchantName, setNewMerchantName] = useState("");
  const [createdApiKeyOnce, setCreatedApiKeyOnce] = useState<string | null>(null);

  useEffect(() => {
    const t = getJwt();
    if (!t) {
      router.replace("/login");
      return;
    }
    setJwtState(t);
    setMerchantApiKeyState(getMerchantApiKey() || "");
  }, [router]);

  async function refreshMerchants() {
    if (!jwt) return;
    setLoadingMerchants(true);
    setError(null);
    try {
      const ms = await listMerchants(jwt);
      setMerchants(ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando merchants");
    } finally {
      setLoadingMerchants(false);
    }
  }

  async function refreshIntents(apiKey: string) {
    if (!apiKey) return;
    setLoadingIntents(true);
    setError(null);
    try {
      const pis = await listPaymentIntents(apiKey);
      setPaymentIntents(pis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando payment intents");
    } finally {
      setLoadingIntents(false);
    }
  }

  useEffect(() => {
    refreshMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  useEffect(() => {
    if (merchantApiKey) refreshIntents(merchantApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantApiKey]);

  const selectedMerchantSummary = useMemo(() => {
    if (!merchantApiKey) return "No seleccionado";
    return `${merchantApiKey.slice(0, 10)}…${merchantApiKey.slice(-6)}`;
  }, [merchantApiKey]);

  async function onCreateMerchant() {
    if (!jwt) return;
    setError(null);
    try {
      const created = await createMerchant(jwt, newMerchantName.trim());
      setCreatedApiKeyOnce(created.apiKey);
      setNewMerchantName("");
      await refreshMerchants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando merchant");
    }
  }

  function onUseApiKey(apiKey: string) {
    setMerchantApiKey(apiKey);
    setMerchantApiKeyState(apiKey);
    setCreatedApiKeyOnce(null);
  }

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Merchants</h2>
              <div className="muted">JWT requerido para listar/crear merchants.</div>
            </div>
            <button
              onClick={() => {
                clearJwt();
                router.push("/login");
              }}
            >
              Logout
            </button>
          </div>

          <div style={{ height: 12 }} />

          <div className="row">
            <div className="col">
              <label className="label">Crear merchant</label>
              <input
                value={newMerchantName}
                onChange={(e) => setNewMerchantName(e.target.value)}
                placeholder="Mi tienda"
              />
            </div>
            <div style={{ alignSelf: "end" }}>
              <button className="primary" onClick={onCreateMerchant} disabled={!newMerchantName.trim()}>
                Crear
              </button>
            </div>
          </div>

          {createdApiKeyOnce ? (
            <div style={{ marginTop: 12 }} className="card">
              <div className="muted">API key (solo se muestra una vez):</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 6 }}>
                {createdApiKeyOnce}
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="primary" onClick={() => onUseApiKey(createdApiKeyOnce)}>
                  Usar este merchant (guardar X-Api-Key)
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ height: 14 }} />

          <div className="row" style={{ alignItems: "end" }}>
            <div className="col">
              <label className="label">Merchant API key (X-Api-Key) activa</label>
              <input
                value={merchantApiKey}
                onChange={(e) => setMerchantApiKeyState(e.target.value)}
                placeholder="po_demo_..."
              />
            </div>
            <div>
              <button
                className="primary"
                onClick={() => onUseApiKey(merchantApiKey)}
                disabled={!merchantApiKey.trim()}
              >
                Guardar
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10 }} className="muted">
            Seleccionado: <span className="pill">{selectedMerchantSummary}</span>
          </div>

          <div style={{ height: 12 }} />

          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="muted">
              {loadingMerchants ? "Cargando..." : `${merchants.length} merchants`}
            </div>
            <button onClick={refreshMerchants} disabled={loadingMerchants}>
              Refrescar
            </button>
          </div>

          <div style={{ height: 10 }} />

          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {merchants.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <span className="pill">{m.name}</span> <span className="muted">{m.id}</span>
              </li>
            ))}
          </ul>

          {error ? (
            <p className="status-failed" style={{ marginBottom: 0 }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="col">
        <div className="card">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Payment Intents</h2>
              <div className="muted">Requiere X-Api-Key (merchant).</div>
            </div>
            <Link href="/new-payment">
              <button className="primary" disabled={!merchantApiKey}>
                Nuevo pago
              </button>
            </Link>
          </div>

          <div style={{ height: 10 }} />

          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="muted">
              {loadingIntents ? "Cargando..." : `${paymentIntents.length} intents`}
            </div>
            <button onClick={() => refreshIntents(merchantApiKey)} disabled={loadingIntents || !merchantApiKey}>
              Refrescar
            </button>
          </div>

          <div style={{ height: 10 }} />

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Monto</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {paymentIntents.map((pi) => (
                <tr key={pi.id}>
                  <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    <Link href={`/checkout/${pi.id}`}>{pi.id.slice(0, 8)}…</Link>
                  </td>
                  <td>{formatAmount(pi.amountMinor, pi.currency)}</td>
                  <td>{pi.provider}</td>
                  <td className={pi.status === "SUCCEEDED" ? "status-success" : pi.status === "FAILED" ? "status-failed" : ""}>
                    {pi.status}
                  </td>
                  <td className="muted">{pi.routingReasonCode || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!merchantApiKey ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Seteá un <code>X-Api-Key</code> arriba para ver intents.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

