/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

public enum ProviderErrorType {
    TIMEOUT,
    HTTP_5XX,
    VALIDATION,
    PROVIDER_DECLINE,
    UNKNOWN
}

