/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api.providers;

import com.pasarela.application.ProviderConfigService;
import com.pasarela.domain.model.PaymentProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/providers")
public class ProviderConfigController {
    private final ProviderConfigService providerConfigService;

    public ProviderConfigController(ProviderConfigService providerConfigService) {
        this.providerConfigService = providerConfigService;
    }

    @GetMapping("/{provider}")
    public ProviderConfigService.ProviderConfigView get(@PathVariable("provider") PaymentProvider provider) {
        return providerConfigService.get(provider);
    }

    @PutMapping("/{provider}")
    public ProviderConfigService.ProviderConfigView upsert(
            @PathVariable("provider") PaymentProvider provider,
            @RequestBody ProviderConfigService.ProviderConfigRequest request
    ) {
        return providerConfigService.upsert(provider, request);
    }

    @PostMapping("/{provider}/disable")
    public ProviderConfigService.ProviderConfigView disable(@PathVariable("provider") PaymentProvider provider) {
        return providerConfigService.disable(provider);
    }
}
