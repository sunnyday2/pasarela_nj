/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api;

public record ApiErrorResponse(
        String error,
        String message,
        String requestId
) {}

