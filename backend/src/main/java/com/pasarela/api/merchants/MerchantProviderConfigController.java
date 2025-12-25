/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api.merchants;

import com.pasarela.application.MerchantProviderConfigService;
import com.pasarela.domain.model.PaymentProvider;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/merchants/{merchantId}/providers")
public class MerchantProviderConfigController {
    private final MerchantProviderConfigService providerConfigService;

    public MerchantProviderConfigController(MerchantProviderConfigService providerConfigService) {
        this.providerConfigService = providerConfigService;
    }

    @GetMapping
    public List<MerchantProviderConfigService.ProviderConfigView> list(@PathVariable("merchantId") UUID merchantId) {
        return providerConfigService.list(merchantId);
    }

    @PutMapping("/{provider}")
    public MerchantProviderConfigService.ProviderConfigView upsert(
            @PathVariable("merchantId") UUID merchantId,
            @PathVariable("provider") PaymentProvider provider,
            @RequestBody MerchantProviderConfigService.ProviderConfigRequest request
    ) {
        return providerConfigService.upsert(merchantId, provider, request);
    }

    @DeleteMapping("/{provider}")
    public MerchantProviderConfigService.ProviderConfigView disable(
            @PathVariable("merchantId") UUID merchantId,
            @PathVariable("provider") PaymentProvider provider
    ) {
        return providerConfigService.disable(merchantId, provider);
    }
}
