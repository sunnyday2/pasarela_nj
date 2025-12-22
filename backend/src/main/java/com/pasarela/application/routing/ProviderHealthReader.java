/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application.routing;

import com.pasarela.domain.model.PaymentProvider;

public interface ProviderHealthReader {
    ProviderSnapshot getSnapshot(PaymentProvider provider);
}

