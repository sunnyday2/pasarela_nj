/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.security;

import com.pasarela.domain.model.UserRole;

public record JwtPrincipal(String email, UserRole role) {}

