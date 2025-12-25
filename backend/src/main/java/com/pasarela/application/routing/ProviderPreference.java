/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application.routing;

import com.pasarela.domain.model.PaymentProvider;

public enum ProviderPreference {
    AUTO,
    STRIPE,
    ADYEN,
    DEMO,
    PAYPAL,
    TRANSBANK;

    public PaymentProvider toProvider() {
        return switch (this) {
            case STRIPE -> PaymentProvider.STRIPE;
            case ADYEN -> PaymentProvider.ADYEN;
            case DEMO -> PaymentProvider.DEMO;
            case PAYPAL -> PaymentProvider.PAYPAL;
            case TRANSBANK -> PaymentProvider.TRANSBANK;
            case AUTO -> throw new IllegalStateException("AUTO is not a provider");
        };
    }
}
