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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.payments.mode=demo")
@ActiveProfiles("test")
class PaymentIntentDemoModeTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private MerchantRepository merchantRepository;

    private String apiKey;

    @BeforeEach
    void setUp() {
        apiKey = "demo_key_123";
        MerchantEntity merchant = new MerchantEntity();
        merchant.setName("demo-merchant");
        merchant.setApiKeyHash(Sha256.hex(apiKey));
        merchant.setConfigJson("{}");
        merchantRepository.save(merchant);
    }

    @Test
    void createPaymentIntentReturnsDemoCheckoutConfig() {
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

        assertEquals(HttpStatus.OK, res.getStatusCode());
        Map body = res.getBody();
        assertNotNull(body);
        assertEquals("DEMO", body.get("provider"));

        Object checkoutConfig = body.get("checkoutConfig");
        assertNotNull(checkoutConfig);
        if (checkoutConfig instanceof Map cfg) {
            assertEquals("DEMO", cfg.get("type"));
        }
    }
}
