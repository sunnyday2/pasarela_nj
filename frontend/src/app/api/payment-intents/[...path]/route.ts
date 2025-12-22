/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { proxyPaymentIntents } from "../_proxy";

export async function GET(request: Request) {
  return proxyPaymentIntents(request);
}

export async function POST(request: Request) {
  return proxyPaymentIntents(request);
}

export async function PATCH(request: Request) {
  return proxyPaymentIntents(request);
}

export async function PUT(request: Request) {
  return proxyPaymentIntents(request);
}

export async function DELETE(request: Request) {
  return proxyPaymentIntents(request);
}
