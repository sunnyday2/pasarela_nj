/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.domain.model.PaymentProvider;

import java.util.UUID;
import java.util.Map;

public record CreateSessionCommand(
        UUID merchantId,
        UUID paymentIntentId,
        long amountMinor,
        String currency,
        String description,
        String idempotencyKey,
        String returnUrl,
        PaymentProvider provider,
        Map<String, String> providerConfig
) {}
