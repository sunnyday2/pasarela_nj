/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application;

import com.pasarela.domain.model.PaymentProvider;
import com.pasarela.infrastructure.provider.PaymentProviderAdapter;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Registry que resuelve el adapter por PaymentProvider.
 */
@Component
public class ProviderAdapterRegistry {

    private final List<PaymentProviderAdapter> adapters;
    private volatile EnumMap<PaymentProvider, PaymentProviderAdapter> adaptersByProvider;

    public ProviderAdapterRegistry(List<PaymentProviderAdapter> adapters) {
        this.adapters = adapters == null ? List.of() : List.copyOf(adapters);
    }

    public PaymentProviderAdapter get(PaymentProvider provider) {
        return getRequired(provider);
    }

    public PaymentProviderAdapter getRequired(PaymentProvider provider) {
        PaymentProviderAdapter adapter = ensureInitialized().get(provider);
        if (adapter == null) {
            throw new IllegalArgumentException("No existe ProviderAdapter registrado para provider=" + provider);
        }
        return adapter;
    }

    public Optional<PaymentProviderAdapter> find(PaymentProvider provider) {
        return Optional.ofNullable(ensureInitialized().get(provider));
    }

    public Set<PaymentProvider> registeredProviders() {
        return Collections.unmodifiableSet(ensureInitialized().keySet());
    }

    public Map<PaymentProvider, PaymentProviderAdapter> asMapView() {
        return Collections.unmodifiableMap(ensureInitialized());
    }

    private EnumMap<PaymentProvider, PaymentProviderAdapter> ensureInitialized() {
        EnumMap<PaymentProvider, PaymentProviderAdapter> snapshot = adaptersByProvider;
        if (snapshot != null) {
            return snapshot;
        }
        synchronized (this) {
            if (adaptersByProvider == null) {
                adaptersByProvider = buildRegistry();
            }
            return adaptersByProvider;
        }
    }

    private EnumMap<PaymentProvider, PaymentProviderAdapter> buildRegistry() {
        EnumMap<PaymentProvider, PaymentProviderAdapter> registry = new EnumMap<>(PaymentProvider.class);
        for (PaymentProviderAdapter adapter : adapters) {
            if (adapter == null) {
                throw new IllegalStateException("ProviderAdapter list contiene null");
            }

            PaymentProvider provider = adapter.provider();
            if (provider == null) {
                throw new IllegalStateException(
                        "ProviderAdapter " + adapter.getClass().getName()
                                + " devolvió provider=null. Debe retornar un PaymentProvider válido."
                );
            }

            PaymentProviderAdapter existing = registry.putIfAbsent(provider, adapter);
            if (existing != null) {
                throw new IllegalStateException(
                        "Adapter duplicado para provider=" + provider
                                + ". Existente=" + existing.getClass().getName()
                                + ", nuevo=" + adapter.getClass().getName()
                );
            }
        }
        return registry;
    }
}
