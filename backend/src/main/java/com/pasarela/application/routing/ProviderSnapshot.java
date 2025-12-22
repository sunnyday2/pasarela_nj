/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application.routing;

import com.pasarela.domain.model.CircuitState;
import com.pasarela.domain.model.PaymentProvider;

import java.time.Instant;

public record ProviderSnapshot(
        PaymentProvider provider,
        CircuitState circuitState,
        double successRate,
        double errorRate,
        long p95LatencyMs,
        Instant lastFailureAt,
        Instant updatedAt
) {}

