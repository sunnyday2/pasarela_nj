/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Frontend frontend,
        Jwt jwt,
        Crypto crypto,
        Providers providers
) {
    public record Frontend(String baseUrl) {}

    public record Jwt(String secret, long ttlSeconds) {}

    public record Crypto(String encryptionKeyBase64) {}

    public record Providers(Stripe stripe, Adyen adyen, Mastercard mastercard) {
        public record Stripe(String secretKey, String publishableKey, String webhookSecret) {}

        public record Adyen(
                String apiKey,
                String merchantAccount,
                String clientKey,
                String hmacKey,
                String environment
        ) {}

        public record Mastercard(
                String gatewayHost,
                String apiVersion,
                String merchantId,
                String apiPassword
        ) {}
    }
}
