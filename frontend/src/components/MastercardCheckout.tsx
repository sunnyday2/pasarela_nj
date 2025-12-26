/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  scriptUrl: string;
  merchantId: string;
  sessionId: string;
  orderId: string;
  amount: string;
  currency: string;
  returnUrl: string;
  successIndicator?: string;
};

type CheckoutApi = {
  configure: (opts: Record<string, unknown>) => void;
  showPaymentPage: () => void;
};

function getCheckout(): CheckoutApi | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as unknown as { Checkout?: CheckoutApi };
  return anyWindow.Checkout || null;
}

export function MastercardCheckout(props: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedScriptUrl = useMemo(() => props.scriptUrl.trim(), [props.scriptUrl]);

  useEffect(() => {
    if (!normalizedScriptUrl) {
      setError("Script de checkout no disponible");
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-mc-checkout="${normalizedScriptUrl}"]`
    );
    if (existing) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const script = document.createElement("script");
    script.src = normalizedScriptUrl;
    script.async = true;
    script.dataset.mcCheckout = normalizedScriptUrl;
    script.onload = () => {
      if (!cancelled) setReady(true);
    };
    script.onerror = () => {
      if (!cancelled) setError("Error cargando Mastercard checkout");
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [normalizedScriptUrl]);

  useEffect(() => {
    if (!ready) return;
    const checkout = getCheckout();
    if (!checkout) {
      setError("Checkout no disponible en la página");
      return;
    }
    checkout.configure({
      merchant: props.merchantId,
      session: { id: props.sessionId },
      order: {
        id: props.orderId,
        amount: props.amount,
        currency: props.currency
      },
      interaction: {
        operation: "PURCHASE",
        returnUrl: props.returnUrl
      }
    });
  }, [ready, props.amount, props.currency, props.merchantId, props.orderId, props.returnUrl, props.sessionId]);

  function onOpenCheckout() {
    setError(null);
    const checkout = getCheckout();
    if (!checkout) {
      setError("Checkout no disponible en la página");
      return;
    }
    checkout.showPaymentPage();
  }

  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Mastercard Hosted Checkout
      </div>
      <button className="primary" onClick={onOpenCheckout} disabled={!ready}>
        {ready ? "Pagar con Mastercard" : "Cargando checkout..."}
      </button>
      {props.successIndicator ? (
        <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
          successIndicator: <span className="pill">{props.successIndicator}</span>
        </p>
      ) : null}
      {error ? (
        <p className="status-failed" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
