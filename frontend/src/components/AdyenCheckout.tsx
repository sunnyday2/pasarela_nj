/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  clientKey: string;
  environment: "test" | "live" | "live-us" | "live-au" | "live-apse" | "live-in";
  sessionId: string;
  sessionData: string;
};

type AdyenDropin = { mount: (el: HTMLElement) => void; unmount?: () => void };
type AdyenCheckoutCore = { create: (type: string) => AdyenDropin };

export function AdyenCheckout(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dropin: AdyenDropin | null = null;
    let cancelled = false;

    async function mount() {
      setError(null);
      try {
        const { AdyenCheckout: AdyenCheckoutCtor } = await import("@adyen/adyen-web");
        if (cancelled) return;
        const checkout = (await AdyenCheckoutCtor({
          environment: props.environment,
          clientKey: props.clientKey,
          session: {
            id: props.sessionId,
            sessionData: props.sessionData
          },
          onError: (err: unknown) => {
            const msg =
              typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Error";
            setError(msg);
          }
        })) as unknown as AdyenCheckoutCore;
        if (!containerRef.current) return;
        const instance = checkout.create("dropin");
        dropin = instance;
        instance.mount(containerRef.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inicializando Adyen");
      }
    }

    mount();
    return () => {
      cancelled = true;
      if (dropin?.unmount) dropin.unmount();
    };
  }, [props.clientKey, props.environment, props.sessionData, props.sessionId]);

  return (
    <div>
      <div ref={containerRef} />
      {error ? (
        <p className="status-failed" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
