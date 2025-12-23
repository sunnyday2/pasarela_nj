/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayRepairConfig {
    private static final Logger log = LoggerFactory.getLogger(FlywayRepairConfig.class);

    @Bean
    @ConditionalOnProperty(prefix = "pasarela.flyway", name = "auto-repair", havingValue = "true")
    public FlywayMigrationStrategy flywayRepairMigrationStrategy() {
        return flyway -> {
            log.warn("pasarela.flyway.auto-repair enabled: running Flyway.repair() before migrate");
            flyway.repair();
            flyway.migrate();
        };
    }
}
