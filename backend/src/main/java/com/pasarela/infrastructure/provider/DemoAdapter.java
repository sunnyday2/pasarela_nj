/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.config.AppProperties;
import com.pasarela.domain.model.PaymentProvider;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class DemoAdapter implements PaymentProviderAdapter {
    private final AppProperties properties;

    public DemoAdapter(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    public PaymentProvider provider() {
        return PaymentProvider.DEMO;
    }

    @Override
    public CreateSessionResult createSession(CreateSessionCommand command) {
        Map<String, Object> checkoutConfig = new HashMap<>();
        checkoutConfig.put("type", "DEMO");
        checkoutConfig.put("paymentIntentId", command.paymentIntentId().toString());
        checkoutConfig.put("amountMinor", command.amountMinor());
        checkoutConfig.put("currency", command.currency());
        checkoutConfig.put("message", "Demo mode active. No external provider configured.");
        checkoutConfig.put("checkoutUrl", demoCheckoutUrl(command.paymentIntentId().toString()));

        String providerRef = "demo_" + command.paymentIntentId();
        return new CreateSessionResult(providerRef, checkoutConfig);
    }

    @Override
    public RefundResult refund(RefundCommand command) {
        String refundRef = "demo_refund_" + (command.providerRef() == null ? "unknown" : command.providerRef());
        return new RefundResult(refundRef);
    }

    private String demoCheckoutUrl(String paymentIntentId) {
        String baseUrl = properties.frontend().baseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:3000";
        }
        return baseUrl.replaceAll("/$", "") + "/demo-checkout/" + paymentIntentId;
    }
}
