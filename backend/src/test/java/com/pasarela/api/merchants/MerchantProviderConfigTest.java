/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api.merchants;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MerchantProviderConfigTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void upsertListAndDisableProviderConfig() {
        String token = registerAdmin();
        String merchantId = createMerchant(token);

        HttpHeaders headers = authHeaders(token);
        Map<String, Object> request = Map.of(
                "enabled", true,
                "config", Map.of(
                        "secretKey", "sk_test_123",
                        "publishableKey", "pk_test_123",
                        "webhookSecret", "whsec_123"
                )
        );

        ResponseEntity<Map> upsert = restTemplate.exchange(
                "/api/merchants/" + merchantId + "/providers/STRIPE",
                HttpMethod.PUT,
                new HttpEntity<>(request, headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, upsert.getStatusCode());
        Map body = upsert.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("enabled"));
        Map config = (Map) body.get("config");
        assertNotNull(config);
        String masked = String.valueOf(config.get("secretKey"));
        assertTrue(masked.contains("****"));
        assertTrue(!masked.contains("sk_test_123"));

        ResponseEntity<List<Map<String, Object>>> listRes = restTemplate.exchange(
                "/api/merchants/" + merchantId + "/providers",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {}
        );
        assertEquals(HttpStatus.OK, listRes.getStatusCode());
        List<Map<String, Object>> list = listRes.getBody();
        assertNotNull(list);
        assertTrue(list.stream().anyMatch(item -> "STRIPE".equals(item.get("provider"))));

        ResponseEntity<Map> disabled = restTemplate.exchange(
                "/api/merchants/" + merchantId + "/providers/STRIPE",
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, disabled.getStatusCode());
        Map disabledBody = disabled.getBody();
        assertNotNull(disabledBody);
        assertEquals(false, disabledBody.get("enabled"));
    }

    private String registerAdmin() {
        String email = "admin-" + UUID.randomUUID() + "@example.com";
        Map<String, String> request = Map.of(
                "email", email,
                "password", "password123"
        );
        ResponseEntity<Map> res = restTemplate.postForEntity("/api/auth/register", request, Map.class);
        assertEquals(HttpStatus.OK, res.getStatusCode());
        Map body = res.getBody();
        assertNotNull(body);
        return String.valueOf(body.get("token"));
    }

    private String createMerchant(String token) {
        HttpHeaders headers = authHeaders(token);
        ResponseEntity<Map> res = restTemplate.postForEntity(
                "/api/merchants",
                new HttpEntity<>(Map.of("name", "merchant"), headers),
                Map.class
        );
        assertEquals(HttpStatus.OK, res.getStatusCode());
        Map body = res.getBody();
        assertNotNull(body);
        Map merchant = (Map) body.get("merchant");
        assertNotNull(merchant);
        return String.valueOf(merchant.get("id"));
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        return headers;
    }
}
