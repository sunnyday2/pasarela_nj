/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, register } from "@/lib/api";
import { setJwt } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === "login" ? await login(email, password) : await register(email, password);
      setJwt(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Login" : "Registro"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        JWT para endpoints admin (merchants / observability). Los Payment Intents se autentican con <code>X-Api-Key</code>.
      </p>

      <form onSubmit={onSubmit}>
        <label className="label">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />

        <div style={{ height: 10 }} />

        <label className="label">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />

        {error ? (
          <p className="status-failed" style={{ marginBottom: 0 }}>
            {error}
          </p>
        ) : null}

        <div style={{ height: 14 }} />

        <div className="row">
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
            disabled={loading}
          >
            {mode === "login" ? "Crear usuario" : "Ya tengo usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}

