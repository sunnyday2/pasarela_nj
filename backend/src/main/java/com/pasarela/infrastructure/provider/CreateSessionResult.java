/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import java.util.Map;

public record CreateSessionResult(
        String providerRef,
        Map<String, Object> checkoutConfig
) {}

