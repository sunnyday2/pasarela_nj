/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pasarela.api.ApiException;
import com.pasarela.config.AppProperties;
import com.pasarela.domain.model.PaymentProvider;
import com.pasarela.infrastructure.crypto.AesGcmCrypto;
import com.pasarela.infrastructure.persistence.entity.ProviderConfigEntity;
import com.pasarela.infrastructure.persistence.repository.ProviderConfigRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ProviderConfigService {
    private static final TypeReference<Map<String, String>> MAP = new TypeReference<>() {};

    private static final Map<PaymentProvider, ProviderSchema> SCHEMAS = Map.of(
            PaymentProvider.STRIPE, new ProviderSchema(
                    List.of("secretKey", "publishableKey"),
                    List.of("webhookSecret")
            ),
            PaymentProvider.ADYEN, new ProviderSchema(
                    List.of("apiKey", "merchantAccount", "clientKey"),
                    List.of("hmacKey", "environment")
            ),
            PaymentProvider.MASTERCARD, new ProviderSchema(
                    List.of("gatewayHost", "apiVersion", "merchantId", "apiPassword"),
                    List.of()
            ),
            PaymentProvider.PAYPAL, new ProviderSchema(
                    List.of("clientId", "clientSecret"),
                    List.of("environment")
            )
    );

    private final ProviderConfigRepository configRepository;
    private final AesGcmCrypto crypto;
    private final ObjectMapper objectMapper;
    private final AppProperties properties;

    public ProviderConfigService(
            ProviderConfigRepository configRepository,
            AesGcmCrypto crypto,
            ObjectMapper objectMapper,
            AppProperties properties
    ) {
        this.configRepository = configRepository;
        this.crypto = crypto;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public List<ProviderConfigView> list() {
        Map<PaymentProvider, ProviderConfigEntity> byProvider = new EnumMap<>(PaymentProvider.class);
        for (ProviderConfigEntity entity : configRepository.findAll()) {
            byProvider.put(entity.getProvider(), entity);
        }

        List<ProviderConfigView> views = new ArrayList<>();
        for (PaymentProvider provider : PaymentProvider.values()) {
            if (provider == PaymentProvider.DEMO) {
                views.add(new ProviderConfigView(provider, true, true, Map.of(), List.of(), false));
                continue;
            }
            if (!SCHEMAS.containsKey(provider)) {
                continue;
            }
            ProviderConfigEntity entity = byProvider.get(provider);
            if (entity == null) {
                views.add(new ProviderConfigView(provider, false, false, Map.of(), missingRequiredFields(provider, Map.of()), true));
                continue;
            }
            Map<String, String> config = decryptConfig(entity.getConfigJsonEnc());
            List<String> missing = missingRequiredFields(provider, config);
            views.add(new ProviderConfigView(provider, entity.isEnabled(), missing.isEmpty(), maskConfig(provider, config), missing, true));
        }
        return views;
    }

    public ProviderConfigView get(PaymentProvider provider) {
        if (provider == PaymentProvider.DEMO) {
            return new ProviderConfigView(provider, true, true, Map.of(), List.of(), false);
        }
        ProviderSchema schema = requireSchema(provider);
        Optional<ProviderConfigEntity> entityOpt = configRepository.findByProvider(provider);
        if (entityOpt.isEmpty()) {
            return new ProviderConfigView(provider, false, false, Map.of(), schema.required(), true);
        }
        ProviderConfigEntity entity = entityOpt.get();
        Map<String, String> config = decryptConfig(entity.getConfigJsonEnc());
        List<String> missing = missingRequiredFields(provider, config);
        return new ProviderConfigView(provider, entity.isEnabled(), missing.isEmpty(), maskConfig(provider, config), missing, true);
    }

    @Transactional
    public ProviderConfigView upsert(PaymentProvider provider, ProviderConfigRequest request) {
        if (provider == PaymentProvider.DEMO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DEMO does not require configuration");
        }
        ProviderSchema schema = requireSchema(provider);

        ProviderConfigEntity entity = configRepository.findByProvider(provider)
                .orElseGet(ProviderConfigEntity::new);

        boolean enabled = request != null && request.enabled() != null ? request.enabled() : true;

        Map<String, String> existing = entity.getId() == null
                ? Map.of()
                : decryptConfig(entity.getConfigJsonEnc());

        Map<String, String> merged = mergeConfig(existing, request == null ? null : request.config());
        List<String> missing = missingRequiredFields(provider, merged);
        if (enabled && !missing.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Missing required config values for " + provider + ": " + String.join(", ", missing)
            );
        }

        entity.setProvider(provider);
        entity.setEnabled(enabled);
        entity.setConfigJsonEnc(encryptConfig(merged));
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(Instant.now());
        }

        ProviderConfigEntity saved = configRepository.save(entity);
        return new ProviderConfigView(provider, saved.isEnabled(), missing.isEmpty(), maskConfig(provider, merged), missing, true);
    }

    @Transactional
    public ProviderConfigView disable(PaymentProvider provider) {
        if (provider == PaymentProvider.DEMO) {
            return new ProviderConfigView(provider, true, true, Map.of(), List.of(), false);
        }
        ProviderSchema schema = requireSchema(provider);

        Optional<ProviderConfigEntity> entityOpt = configRepository.findByProvider(provider);
        if (entityOpt.isEmpty()) {
            return new ProviderConfigView(provider, false, false, Map.of(), schema.required(), true);
        }

        ProviderConfigEntity entity = entityOpt.get();
        entity.setEnabled(false);
        ProviderConfigEntity saved = configRepository.save(entity);
        Map<String, String> config = decryptConfig(saved.getConfigJsonEnc());
        List<String> missing = missingRequiredFields(provider, config);
        return new ProviderConfigView(provider, false, missing.isEmpty(), maskConfig(provider, config), missing, true);
    }

    public Optional<ProviderConfig> find(PaymentProvider provider) {
        return configRepository.findByProvider(provider)
                .map(entity -> new ProviderConfig(
                        entity.getProvider(),
                        entity.isEnabled(),
                        decryptConfig(entity.getConfigJsonEnc())
                ));
    }

    public EffectiveConfig resolveEffectiveConfig(PaymentProvider provider) {
        if (provider == PaymentProvider.DEMO) {
            return new EffectiveConfig(true, true, Map.of(), "DEMO", List.of());
        }
        Optional<ProviderConfigEntity> entityOpt = configRepository.findByProvider(provider);
        if (entityOpt.isPresent()) {
            ProviderConfigEntity entity = entityOpt.get();
            Map<String, String> config = decryptConfig(entity.getConfigJsonEnc());
            List<String> missing = missingRequiredFields(provider, config);
            return new EffectiveConfig(missing.isEmpty(), entity.isEnabled(), config, "DB", missing);
        }

        Map<String, String> envConfig = fallbackConfig(provider);
        if (!envConfig.isEmpty()) {
            List<String> missing = missingRequiredFields(provider, envConfig);
            boolean configured = missing.isEmpty();
            return new EffectiveConfig(configured, configured, envConfig, "ENV", missing);
        }

        return new EffectiveConfig(false, false, Map.of(), "NONE", missingRequiredFields(provider, Map.of()));
    }

    public List<String> missingRequiredFields(PaymentProvider provider, Map<String, String> config) {
        ProviderSchema schema = SCHEMAS.get(provider);
        if (schema == null) return List.of();
        List<String> missing = new ArrayList<>();
        for (String key : schema.required()) {
            String value = config == null ? null : config.get(key);
            if (value == null || value.isBlank()) {
                missing.add(key);
            }
        }
        return missing;
    }

    private ProviderSchema requireSchema(PaymentProvider provider) {
        ProviderSchema schema = SCHEMAS.get(provider);
        if (schema == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provider not supported for config: " + provider);
        }
        return schema;
    }

    private Map<String, String> fallbackConfig(PaymentProvider provider) {
        if (properties.providers() == null) return Map.of();
        return switch (provider) {
            case STRIPE -> {
                var stripe = properties.providers().stripe();
                if (stripe == null) {
                    yield Map.of();
                }
                Map<String, String> cfg = new HashMap<>();
                putIfNotBlank(cfg, "secretKey", stripe.secretKey());
                putIfNotBlank(cfg, "publishableKey", stripe.publishableKey());
                putIfNotBlank(cfg, "webhookSecret", stripe.webhookSecret());
                yield cfg;
            }
            case ADYEN -> {
                var adyen = properties.providers().adyen();
                if (adyen == null) {
                    yield Map.of();
                }
                Map<String, String> cfg = new HashMap<>();
                putIfNotBlank(cfg, "apiKey", adyen.apiKey());
                putIfNotBlank(cfg, "merchantAccount", adyen.merchantAccount());
                putIfNotBlank(cfg, "clientKey", adyen.clientKey());
                putIfNotBlank(cfg, "hmacKey", adyen.hmacKey());
                putIfNotBlank(cfg, "environment", adyen.environment());
                yield cfg;
            }
            case MASTERCARD -> {
                if (properties.providers().mastercard() == null) {
                    yield Map.of();
                }
                var mc = properties.providers().mastercard();
                Map<String, String> cfg = new HashMap<>();
                putIfNotBlank(cfg, "gatewayHost", mc.gatewayHost());
                putIfNotBlank(cfg, "apiVersion", mc.apiVersion());
                putIfNotBlank(cfg, "merchantId", mc.merchantId());
                putIfNotBlank(cfg, "apiPassword", mc.apiPassword());
                yield cfg;
            }
            default -> Map.of();
        };
    }

    private void putIfNotBlank(Map<String, String> config, String key, String value) {
        if (value == null || value.isBlank()) return;
        config.put(key, value.trim());
    }

    private Map<String, String> mergeConfig(Map<String, String> base, Map<String, String> updates) {
        Map<String, String> merged = new HashMap<>();
        if (base != null) {
            base.forEach((key, value) -> {
                if (value != null && !value.isBlank()) merged.put(key, value.trim());
            });
        }
        if (updates != null) {
            updates.forEach((key, value) -> {
                if (value != null && !value.isBlank()) merged.put(key, value.trim());
            });
        }
        return merged;
    }

    private Map<String, String> decryptConfig(String token) {
        if (token == null || token.isBlank()) return Map.of();
        try {
            byte[] json = crypto.decryptToBytes(token);
            Map<String, String> map = objectMapper.readValue(new String(json, StandardCharsets.UTF_8), MAP);
            return map == null ? Map.of() : map;
        } catch (Exception e) {
            throw new IllegalStateException("provider config decrypt failed", e);
        }
    }

    private String encryptConfig(Map<String, String> config) {
        try {
            byte[] json = objectMapper.writeValueAsBytes(config == null ? Map.of() : config);
            return crypto.encryptToString(json);
        } catch (Exception e) {
            throw new IllegalStateException("provider config encrypt failed", e);
        }
    }

    private Map<String, String> maskConfig(PaymentProvider provider, Map<String, String> config) {
        ProviderSchema schema = SCHEMAS.get(provider);
        if (schema == null) return Map.of();
        Map<String, String> masked = new HashMap<>();
        if (config == null) return masked;
        List<String> keys = new ArrayList<>();
        keys.addAll(schema.required());
        keys.addAll(schema.optional());
        for (String key : keys) {
            String raw = config.get(key);
            if (raw == null || raw.isBlank()) continue;
            masked.put(key, maskValue(raw));
        }
        return masked;
    }

    private String maskValue(String raw) {
        String trimmed = raw.trim();
        if (trimmed.length() <= 4) return "****";
        int head = Math.min(4, trimmed.length());
        int tail = Math.min(4, trimmed.length() - head);
        String prefix = trimmed.substring(0, head);
        String suffix = tail > 0 ? trimmed.substring(trimmed.length() - tail) : "";
        return prefix + "****" + suffix;
    }

    private record ProviderSchema(
            List<String> required,
            List<String> optional
    ) {}

    public record ProviderConfig(
            PaymentProvider provider,
            boolean enabled,
            Map<String, String> config
    ) {}

    public record ProviderConfigView(
            PaymentProvider provider,
            boolean enabled,
            boolean configured,
            Map<String, String> config,
            List<String> missingFields,
            boolean configurable
    ) {}

    public record ProviderConfigRequest(
            Boolean enabled,
            Map<String, String> config
    ) {}

    public record EffectiveConfig(
            boolean configured,
            boolean enabled,
            Map<String, String> config,
            String source,
            List<String> missingFields
    ) {}
}
