/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.config;

import com.pasarela.infrastructure.persistence.repository.MerchantRepository;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class JpaContextTest {
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private MerchantRepository merchantRepository;

    @Test
    void contextLoadsWithJpa() {
        assertNotNull(entityManagerFactory);
        assertNotNull(merchantRepository);
    }
}
