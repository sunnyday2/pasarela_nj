/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application;

import com.pasarela.application.routing.ProviderHealthService;
import com.pasarela.application.routing.ProviderSnapshot;
import com.pasarela.domain.model.CircuitState;
import com.pasarela.domain.model.PaymentProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ProviderAvailabilityService {
    private static final List<PaymentProvider> ORDERED = List.of(
            PaymentProvider.STRIPE,
            PaymentProvider.ADYEN,
            PaymentProvider.MASTERCARD,
            PaymentProvider.PAYPAL,
            PaymentProvider.DEMO
    );

    private final ProviderAdapterRegistry providerAdapterRegistry;
    private final ProviderHealthService providerHealthService;
    private final MerchantProviderConfigService merchantProviderConfigService;
    private final ProviderConfigService providerConfigService;

    public ProviderAvailabilityService(
            ProviderAdapterRegistry providerAdapterRegistry,
            ProviderHealthService providerHealthService,
            MerchantProviderConfigService merchantProviderConfigService,
            ProviderConfigService providerConfigService
    ) {
        this.providerAdapterRegistry = providerAdapterRegistry;
        this.providerHealthService = providerHealthService;
        this.merchantProviderConfigService = merchantProviderConfigService;
        this.providerConfigService = providerConfigService;
    }

    public List<ProviderStatus> listForMerchant(UUID merchantId) {
        Set<PaymentProvider> supported = providerAdapterRegistry.registeredProviders();
        List<ProviderStatus> statuses = new ArrayList<>();
        for (PaymentProvider provider : ORDERED) {
            statuses.add(resolveStatus(merchantId, provider, supported));
        }
        return statuses;
    }

    public ProviderStatus getStatus(UUID merchantId, PaymentProvider provider) {
        if (provider == null) return null;
        Set<PaymentProvider> supported = providerAdapterRegistry.registeredProviders();
        return resolveStatus(merchantId, provider, supported);
    }

    public boolean isProviderAvailable(UUID merchantId, PaymentProvider provider) {
        ProviderStatus status = getStatus(merchantId, provider);
        return status != null && status.available();
    }

    public List<PaymentProvider> availableProviders(UUID merchantId, Set<PaymentProvider> excluded) {
        List<PaymentProvider> available = new ArrayList<>();
        for (ProviderStatus status : listForMerchant(merchantId)) {
            if (status.provider() == PaymentProvider.DEMO) continue;
            if (!status.available()) continue;
            if (excluded != null && excluded.contains(status.provider())) continue;
            available.add(status.provider());
        }
        return available;
    }

    private ProviderStatus resolveStatus(UUID merchantId, PaymentProvider provider, Set<PaymentProvider> supported) {
        if (provider == PaymentProvider.DEMO) {
            return new ProviderStatus(provider, true, true, true, "DEMO");
        }
        if (provider == PaymentProvider.PAYPAL) {
            return new ProviderStatus(provider, false, false, false, "NOT_IMPLEMENTED");
        }
        if (!supported.contains(provider)) {
            return new ProviderStatus(provider, false, false, false, "NOT_SUPPORTED");
        }

        ProviderConfigState configState = resolveConfigState(merchantId, provider);
        if (!configState.configured()) {
            String reason = configState.missingFields().isEmpty()
                    ? "NOT_CONFIGURED"
                    : "MISSING_FIELDS:" + String.join(",", configState.missingFields());
            return new ProviderStatus(provider, false, false, false, reason);
        }
        if (!configState.enabled()) {
            return new ProviderStatus(provider, true, false, false, "DISABLED");
        }

        ProviderSnapshot snapshot = providerHealthService.getSnapshot(provider);
        boolean healthy = snapshot.circuitState() != CircuitState.OPEN;
        return new ProviderStatus(provider, true, true, healthy, healthy ? "OK" : "UNHEALTHY");
    }

    private ProviderConfigState resolveConfigState(UUID merchantId, PaymentProvider provider) {
        if (merchantId != null) {
            Optional<MerchantProviderConfigService.MerchantProviderConfig> cfg = merchantProviderConfigService.find(merchantId, provider);
            if (cfg.isPresent()) {
                List<String> missing = providerConfigService.missingRequiredFields(provider, cfg.get().config());
                return new ProviderConfigState(missing.isEmpty(), cfg.get().enabled(), "MERCHANT", missing);
            }
        }

        ProviderConfigService.EffectiveConfig effective = providerConfigService.resolveEffectiveConfig(provider);
        return new ProviderConfigState(
                effective.configured(),
                effective.enabled(),
                effective.source(),
                effective.missingFields()
        );
    }

    private record ProviderConfigState(
            boolean configured,
            boolean enabled,
            String source,
            List<String> missingFields
    ) {}

    public record ProviderStatus(
            PaymentProvider provider,
            boolean configured,
            boolean enabled,
            boolean healthy,
            String reason
    ) {
        public boolean available() {
            return configured && enabled && healthy;
        }
    }
}
