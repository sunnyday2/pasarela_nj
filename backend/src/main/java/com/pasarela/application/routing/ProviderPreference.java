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
    MASTERCARD,
    DEMO,
    PAYPAL;

    public PaymentProvider toProvider() {
        return switch (this) {
            case STRIPE -> PaymentProvider.STRIPE;
            case ADYEN -> PaymentProvider.ADYEN;
            case MASTERCARD -> PaymentProvider.MASTERCARD;
            case DEMO -> PaymentProvider.DEMO;
            case PAYPAL -> PaymentProvider.PAYPAL;
            case AUTO -> throw new IllegalStateException("AUTO is not a provider");
        };
    }

    public static ProviderPreference fromProvider(PaymentProvider provider) {
        if (provider == null) return AUTO;
        return switch (provider) {
            case STRIPE -> STRIPE;
            case ADYEN -> ADYEN;
            case MASTERCARD -> MASTERCARD;
            case PAYPAL -> PAYPAL;
            case DEMO -> DEMO;
        };
    }
}
