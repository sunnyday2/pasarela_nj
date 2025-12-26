/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createMerchant,
  disableProviderConfig,
  getProviderConfig,
  listMerchants,
  listPaymentIntents,
  listProviderStatuses,
  upsertProviderConfig,
  type MerchantDto,
  type PaymentIntentView,
  type PaymentProvider,
  type ProviderConfigView,
  type ProviderStatus
} from "@/lib/api";
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
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>("STRIPE");
  const [providerConfig, setProviderConfig] = useState<ProviderConfigView | null>(null);
  const [providerInputs, setProviderInputs] = useState<Record<string, Record<string, string>>>({});
  const [providerError, setProviderError] = useState<string | null>(null);

  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newMerchantName, setNewMerchantName] = useState("");
  const [createdApiKeyOnce, setCreatedApiKeyOnce] = useState<string | null>(null);

  const PROVIDER_FIELDS: Record<PaymentProvider, { key: string; label: string; required?: boolean }[]> = {
    STRIPE: [
      { key: "secretKey", label: "Secret key", required: true },
      { key: "publishableKey", label: "Publishable key", required: true },
      { key: "webhookSecret", label: "Webhook secret" }
    ],
    ADYEN: [
      { key: "apiKey", label: "API key", required: true },
      { key: "merchantAccount", label: "Merchant account", required: true },
      { key: "clientKey", label: "Client key", required: true },
      { key: "hmacKey", label: "HMAC key" },
      { key: "environment", label: "Environment" }
    ],
    PAYPAL: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", required: true },
      { key: "environment", label: "Environment" }
    ],
    MASTERCARD: [
      { key: "gatewayHost", label: "Gateway host", required: true },
      { key: "apiVersion", label: "API version", required: true },
      { key: "merchantId", label: "Merchant ID", required: true },
      { key: "apiPassword", label: "API password", required: true }
    ],
    DEMO: []
  };

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

  async function refreshProviderStatuses() {
    if (!jwt) return;
    setLoadingProviders(true);
    setProviderError(null);
    try {
      const statuses = await listProviderStatuses(jwt);
      setProviderStatuses(statuses);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Error cargando proveedores");
    } finally {
      setLoadingProviders(false);
    }
  }

  async function refreshProviderConfig(provider: PaymentProvider) {
    if (!jwt) return;
    setProviderError(null);
    setLoadingProviders(true);
    try {
      const cfg = await getProviderConfig(jwt, provider);
      setProviderConfig(cfg);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Error cargando configuración");
    } finally {
      setLoadingProviders(false);
    }
  }

  async function onSaveProvider() {
    if (!jwt) return;
    setProviderError(null);
    setLoadingProviders(true);
    try {
      const config = providerInputs[selectedProvider] || {};
      const updated = await upsertProviderConfig(jwt, selectedProvider, { enabled: true, config });
      setProviderConfig(updated);
      setProviderInputs((prev) => ({ ...prev, [selectedProvider]: {} }));
      await refreshProviderStatuses();
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Error guardando proveedor");
    } finally {
      setLoadingProviders(false);
    }
  }

  async function onDisableProvider() {
    if (!jwt) return;
    setProviderError(null);
    setLoadingProviders(true);
    try {
      const updated = await disableProviderConfig(jwt, selectedProvider);
      setProviderConfig(updated);
      await refreshProviderStatuses();
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Error deshabilitando proveedor");
    } finally {
      setLoadingProviders(false);
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

  useEffect(() => {
    if (!jwt) return;
    refreshProviderStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  useEffect(() => {
    if (!jwt || !selectedProvider) return;
    refreshProviderConfig(selectedProvider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, jwt]);

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

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Proveedores</h2>
              <div className="muted">Configurar credenciales globales (JWT requerido).</div>
            </div>
            <button onClick={refreshProviderStatuses} disabled={loadingProviders}>
              Refrescar
            </button>
          </div>

          <div style={{ height: 10 }} />

          <div className="row" style={{ alignItems: "stretch" }}>
            <div className="col" style={{ maxWidth: 280 }}>
              <div className="muted" style={{ marginBottom: 8 }}>
                Lista de providers
              </div>
              <div className="card">
                {(["STRIPE", "ADYEN", "MASTERCARD", "PAYPAL", "DEMO"] as PaymentProvider[]).map((provider) => {
                  const status = providerStatuses.find((item) => item.provider === provider);
                  const configured = status?.configured ?? false;
                  const enabled = status?.enabled ?? false;
                  const healthy = status?.healthy ?? false;
                  const selected = provider === selectedProvider;
                  return (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className={selected ? "primary" : ""}
                      style={{ width: "100%", textAlign: "left", marginBottom: 8 }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <span>{provider}</span>
                        <span className={`pill ${enabled ? "status-success" : "status-failed"}`}>
                          {enabled ? "On" : "Off"}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {configured ? "Configurado" : "Incompleto"} · {healthy ? "Saludable" : "No saludable"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col">
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="muted">Provider</div>
                    <div className="pill">{selectedProvider}</div>
                  </div>
                  {providerConfig ? (
                    providerConfig.configurable ? (
                      <button onClick={onDisableProvider} disabled={loadingProviders || !providerConfig.enabled}>
                        Deshabilitar
                      </button>
                    ) : (
                      <span className="muted">Demo fijo</span>
                    )
                  ) : (
                    <span className="muted">Cargando...</span>
                  )}
                </div>

                {providerConfig ? (
                  <>
                    {providerConfig.missingFields && providerConfig.missingFields.length > 0 ? (
                      <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                        Faltan: {providerConfig.missingFields.join(", ")}
                      </p>
                    ) : null}

                    {providerConfig.configurable ? (
                      <div style={{ marginTop: 10 }}>
                        {(PROVIDER_FIELDS[selectedProvider] || []).map((field) => {
                          const inputs = providerInputs[selectedProvider] || {};
                          return (
                            <div key={field.key} style={{ marginBottom: 8 }}>
                              <label className="label">
                                {field.label} {field.required ? "(requerido)" : ""}
                              </label>
                              <input
                                value={inputs[field.key] || ""}
                                onChange={(e) =>
                                  setProviderInputs((prev) => ({
                                    ...prev,
                                    [selectedProvider]: { ...(prev[selectedProvider] || {}), [field.key]: e.target.value }
                                  }))
                                }
                                placeholder={
                                  providerConfig.config[field.key]
                                    ? `Guardado: ${providerConfig.config[field.key]}`
                                    : "Actualizar"
                                }
                              />
                            </div>
                          );
                        })}
                        <button className="primary" onClick={onSaveProvider} disabled={loadingProviders}>
                          Guardar y habilitar
                        </button>
                      </div>
                    ) : (
                      <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
                        DEMO no requiere configuración.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
                    Cargando configuración...
                  </p>
                )}
              </div>
            </div>
          </div>

          {providerError ? (
            <p className="status-failed" style={{ marginBottom: 0 }}>
              {providerError}
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
