/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.domain.model.PaymentProvider;

public interface PaymentProviderAdapter {
    PaymentProvider provider();

    CreateSessionResult createSession(CreateSessionCommand command);

    RefundResult refund(RefundCommand command);
}

