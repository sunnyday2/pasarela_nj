/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pasarela.config.RequestIdFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Import(ApiErrorHandlingTest.ConstraintTestController.class)
class ApiErrorHandlingTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void dataIntegrityViolationIncludesRequestId() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set(RequestIdFilter.HEADER, "test-req-123");
        ResponseEntity<String> res = restTemplate.exchange(
                "/api/auth/test/constraint",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                String.class
        );

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode());

        Map<String, Object> body = objectMapper.readValue(res.getBody(), new TypeReference<>() {});
        assertEquals("DATA_INTEGRITY_VIOLATION", body.get("code"));
        assertEquals("test-req-123", body.get("requestId"));
        assertNotNull(body.get("message"));
    }

    @RestController
    @RequestMapping("/api/auth/test")
    static class ConstraintTestController {
        private final JdbcTemplate jdbcTemplate;

        ConstraintTestController(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
        }

        @PostMapping("/constraint")
        public void constraintViolation() {
            UUID merchantId = UUID.randomUUID();
            jdbcTemplate.update(
                    """
                    INSERT INTO merchants (
                      id,
                      name,
                      api_key_hash,
                      config_json,
                      created_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    merchantId.toString(),
                    "merchant-test",
                    UUID.randomUUID().toString().replace("-", ""),
                    "{}",
                    Instant.now().toEpochMilli()
            );

            jdbcTemplate.update(
                    """
                    INSERT INTO routing_decisions (
                      id,
                      payment_intent_id,
                      merchant_id,
                      chosen_provider,
                      candidate_scores_json,
                      reason_code,
                      created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    UUID.randomUUID().toString(),
                    UUID.randomUUID().toString(),
                    merchantId.toString(),
                    "STRIPE",
                    "{}",
                    "TEST",
                    Instant.now().toEpochMilli()
            );
        }
    }
}
