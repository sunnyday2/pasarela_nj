/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

function InnerStripeCheckout() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const res = await stripe.confirmPayment({
        elements,
        redirect: "if_required"
      });
      if (res.error) {
        setError(res.error.message || "Error confirmando pago");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error confirmando pago");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PaymentElement />
      {error ? (
        <p className="status-failed" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
      <div style={{ height: 12 }} />
      <button className="primary" onClick={onConfirm} disabled={!stripe || !elements || submitting}>
        {submitting ? "Procesando..." : "Pagar"}
      </button>
    </div>
  );
}

export function StripeCheckout(props: { publishableKey: string; clientSecret: string }) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <InnerStripeCheckout />
    </Elements>
  );
}

