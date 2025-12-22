/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Pasarela Orchestrator",
  description: "Payment orchestration demo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <main>
          <div className="topbar">
            <h1>Pasarela Orchestrator</h1>
            <div className="row" style={{ gap: 8 }}>
              <Link className="pill" href="/dashboard">
                Dashboard
              </Link>
              <Link className="pill" href="/new-payment">
                Nuevo pago
              </Link>
              <Link className="pill" href="/login">
                Login
              </Link>
            </div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}

