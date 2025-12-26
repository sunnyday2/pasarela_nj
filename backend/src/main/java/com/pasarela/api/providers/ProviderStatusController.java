/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api.providers;

import com.pasarela.api.ApiException;
import com.pasarela.application.ProviderAvailabilityService;
import com.pasarela.domain.security.MerchantPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/providers")
public class ProviderStatusController {
    private final ProviderAvailabilityService providerAvailabilityService;

    public ProviderStatusController(ProviderAvailabilityService providerAvailabilityService) {
        this.providerAvailabilityService = providerAvailabilityService;
    }

    @GetMapping
    public List<ProviderAvailabilityService.ProviderStatus> list(
            @AuthenticationPrincipal MerchantPrincipal merchant,
            Authentication authentication
    ) {
        if (merchant != null) {
            return providerAvailabilityService.listForMerchant(merchant.merchantId());
        }
        if (authentication != null && authentication.isAuthenticated()) {
            return providerAvailabilityService.listForMerchant(null);
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing/Invalid X-Api-Key (or X-Merchant-Api-Key)");
    }
}
