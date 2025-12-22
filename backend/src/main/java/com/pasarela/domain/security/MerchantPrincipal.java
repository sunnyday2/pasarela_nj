/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.domain.security;

import java.util.UUID;

public record MerchantPrincipal(UUID merchantId, String name) {}

