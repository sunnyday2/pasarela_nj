/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.config;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class PaymentsMode {
    private static final String MODE_DEMO = "demo";
    private final String configuredMode;
    private final boolean demoFlag;

    public PaymentsMode(Environment env) {
        this.configuredMode = firstNonBlank(env.getProperty("PAYMENTS_MODE"), env.getProperty("app.payments.mode"));
        this.demoFlag = Boolean.TRUE.equals(env.getProperty("pasarela.demo.provider", Boolean.class))
                || parseBoolean(env.getProperty("PASARELA_DEMO_PROVIDER"));
    }

    public boolean isDemo() {
        return demoFlag || MODE_DEMO.equalsIgnoreCase(configuredMode);
    }

    public String effectiveMode() {
        if (isDemo()) return MODE_DEMO;
        if (configuredMode == null || configuredMode.isBlank()) return "auto";
        return configuredMode.trim().toLowerCase();
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) return primary.trim();
        if (fallback != null && !fallback.isBlank()) return fallback.trim();
        return "";
    }

    private static boolean parseBoolean(String value) {
        if (value == null) return false;
        String v = value.trim().toLowerCase();
        return v.equals("true") || v.equals("1") || v.equals("yes") || v.equals("y");
    }
}
