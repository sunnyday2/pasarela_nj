/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}

