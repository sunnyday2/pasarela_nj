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
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.payments.mode=demo")
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PaymentIntentDemoModeTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private MerchantRepository merchantRepository;

    private String apiKey;

    @BeforeEach
    void setUp() {
        apiKey = "demo_key_" + java.util.UUID.randomUUID();
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

    @Test
    void demoAuthorizeAndCancelUpdateStatus() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Api-Key", apiKey);

        Map<String, Object> request = Map.of(
                "amountMinor", 1500,
                "currency", "EUR",
                "description", "demo",
                "providerPreference", "DEMO"
        );

        ResponseEntity<Map> created = restTemplate.postForEntity(
                "/api/payment-intents",
                new HttpEntity<>(request, headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, created.getStatusCode());
        Map body = created.getBody();
        assertNotNull(body);
        String paymentIntentId = String.valueOf(body.get("paymentIntentId"));

        Map<String, Object> approveReq = Map.of("outcome", "approved");
        ResponseEntity<Map> approved = restTemplate.postForEntity(
                "/api/payment-intents/" + paymentIntentId + "/demo/authorize",
                new HttpEntity<>(approveReq, headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, approved.getStatusCode());
        Map approvedBody = approved.getBody();
        assertNotNull(approvedBody);
        assertEquals("SUCCEEDED", approvedBody.get("status"));

        ResponseEntity<Map> created2 = restTemplate.postForEntity(
                "/api/payment-intents",
                new HttpEntity<>(request, headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, created2.getStatusCode());
        Map body2 = created2.getBody();
        assertNotNull(body2);
        String paymentIntentId2 = String.valueOf(body2.get("paymentIntentId"));

        ResponseEntity<Map> canceled = restTemplate.postForEntity(
                "/api/payment-intents/" + paymentIntentId2 + "/demo/cancel",
                new HttpEntity<>(Map.of(), headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, canceled.getStatusCode());
        Map canceledBody = canceled.getBody();
        assertNotNull(canceledBody);
        assertEquals("FAILED", canceledBody.get("status"));
    }
}
