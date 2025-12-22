/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.domain.model.PaymentProvider;

public record RefundCommand(
        PaymentProvider provider,
        String providerRef,
        long amountMinor,
        String currency,
        String reason
) {}

