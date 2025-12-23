/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api.paymentintents;

import com.pasarela.infrastructure.crypto.Sha256;
import com.pasarela.infrastructure.persistence.entity.MerchantEntity;
import com.pasarela.infrastructure.persistence.repository.MerchantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PaymentIntentNoProvidersTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private MerchantRepository merchantRepository;

    private String apiKey;

    @BeforeEach
    void setUp() {
        apiKey = "no_provider_key";
        MerchantEntity merchant = new MerchantEntity();
        merchant.setName("merchant");
        merchant.setApiKeyHash(Sha256.hex(apiKey));
        merchant.setConfigJson("{}");
        merchantRepository.save(merchant);
    }

    @Test
    void createPaymentIntentWithoutProvidersReturnsClearError() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Api-Key", apiKey);

        Map<String, Object> request = Map.of(
                "amountMinor", 1200,
                "currency", "EUR",
                "description", "demo",
                "providerPreference", "AUTO"
        );

        ResponseEntity<Map> res = restTemplate.postForEntity(
                "/api/payment-intents",
                new HttpEntity<>(request, headers),
                Map.class
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, res.getStatusCode());
        Map body = res.getBody();
        assertNotNull(body);
        assertEquals(
                "No payment providers configured. Set STRIPE_* or ADYEN_* or enable demo mode (PAYMENTS_MODE=demo).",
                body.get("message")
        );
    }
}
