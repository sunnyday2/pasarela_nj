/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.domain.model.PaymentProvider;

import java.util.Map;
import java.util.UUID;

public record RefundCommand(
        PaymentProvider provider,
        UUID merchantId,
        String providerRef,
        long amountMinor,
        String currency,
        String reason,
        Map<String, String> providerConfig
) {}
