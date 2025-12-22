/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.domain.model.PaymentProvider;

public class ProviderException extends RuntimeException {
    private final PaymentProvider provider;
    private final ProviderErrorType type;
    private final String safeMessage;

    public ProviderException(PaymentProvider provider, ProviderErrorType type, String safeMessage, Throwable cause) {
        super(safeMessage, cause);
        this.provider = provider;
        this.type = type;
        this.safeMessage = safeMessage;
    }

    public ProviderException(PaymentProvider provider, ProviderErrorType type, String safeMessage) {
        this(provider, type, safeMessage, null);
    }

    public PaymentProvider getProvider() {
        return provider;
    }

    public ProviderErrorType getType() {
        return type;
    }

    public String getSafeMessage() {
        return safeMessage;
    }
}

