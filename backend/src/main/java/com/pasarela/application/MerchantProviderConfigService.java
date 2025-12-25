/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pasarela.api.ApiException;
import com.pasarela.domain.model.PaymentProvider;
import com.pasarela.infrastructure.crypto.AesGcmCrypto;
import com.pasarela.infrastructure.persistence.entity.MerchantProviderConfigEntity;
import com.pasarela.infrastructure.persistence.repository.MerchantProviderConfigRepository;
import com.pasarela.infrastructure.persistence.repository.MerchantRepository;
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
import java.util.Set;
import java.util.UUID;

@Service
public class MerchantProviderConfigService {
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
            PaymentProvider.PAYPAL, new ProviderSchema(
                    List.of("clientId", "clientSecret"),
                    List.of("environment")
            ),
            PaymentProvider.TRANSBANK, new ProviderSchema(
                    List.of("commerceCode", "apiKey"),
                    List.of("environment")
            )
    );

    private final MerchantRepository merchantRepository;
    private final MerchantProviderConfigRepository configRepository;
    private final AesGcmCrypto crypto;
    private final ObjectMapper objectMapper;

    public MerchantProviderConfigService(
            MerchantRepository merchantRepository,
            MerchantProviderConfigRepository configRepository,
            AesGcmCrypto crypto,
            ObjectMapper objectMapper
    ) {
        this.merchantRepository = merchantRepository;
        this.configRepository = configRepository;
        this.crypto = crypto;
        this.objectMapper = objectMapper;
    }

    public List<ProviderConfigView> list(UUID merchantId) {
        requireMerchant(merchantId);
        Map<PaymentProvider, MerchantProviderConfigEntity> byProvider = new EnumMap<>(PaymentProvider.class);
        for (MerchantProviderConfigEntity entity : configRepository.findByMerchantId(merchantId)) {
            byProvider.put(entity.getProvider(), entity);
        }

        List<ProviderConfigView> views = new ArrayList<>();
        for (PaymentProvider provider : PaymentProvider.values()) {
            if (provider == PaymentProvider.DEMO) {
                views.add(new ProviderConfigView(provider, true, Map.of(), false));
                continue;
            }
            if (!SCHEMAS.containsKey(provider)) {
                continue;
            }
            MerchantProviderConfigEntity entity = byProvider.get(provider);
            if (entity == null) {
                views.add(new ProviderConfigView(provider, false, Map.of(), true));
                continue;
            }
            Map<String, String> config = decryptConfig(entity.getConfigJsonEnc());
            views.add(new ProviderConfigView(provider, entity.isEnabled(), maskConfig(provider, config), true));
        }
        return views;
    }

    @Transactional
    public ProviderConfigView upsert(UUID merchantId, PaymentProvider provider, ProviderConfigRequest request) {
        requireMerchant(merchantId);
        if (provider == PaymentProvider.DEMO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DEMO does not require configuration");
        }
        ProviderSchema schema = requireSchema(provider);

        MerchantProviderConfigEntity entity = configRepository.findByMerchantIdAndProvider(merchantId, provider)
                .orElseGet(MerchantProviderConfigEntity::new);

        boolean enabled = request != null && request.enabled() != null ? request.enabled() : true;

        Map<String, String> existing = entity.getId() == null
                ? Map.of()
                : decryptConfig(entity.getConfigJsonEnc());

        Map<String, String> merged = mergeConfig(existing, request == null ? null : request.config());
        if (enabled) {
            validateRequired(provider, schema, merged);
        }

        entity.setMerchantId(merchantId);
        entity.setProvider(provider);
        entity.setEnabled(enabled);
        entity.setConfigJsonEnc(encryptConfig(merged));
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(Instant.now());
        }

        MerchantProviderConfigEntity saved = configRepository.save(entity);
        return new ProviderConfigView(provider, saved.isEnabled(), maskConfig(provider, merged), true);
    }

    @Transactional
    public ProviderConfigView disable(UUID merchantId, PaymentProvider provider) {
        requireMerchant(merchantId);
        if (provider == PaymentProvider.DEMO) {
            return new ProviderConfigView(provider, true, Map.of(), false);
        }
        ProviderSchema schema = requireSchema(provider);

        Optional<MerchantProviderConfigEntity> entityOpt = configRepository.findByMerchantIdAndProvider(merchantId, provider);
        if (entityOpt.isEmpty()) {
            return new ProviderConfigView(provider, false, Map.of(), true);
        }

        MerchantProviderConfigEntity entity = entityOpt.get();
        entity.setEnabled(false);
        MerchantProviderConfigEntity saved = configRepository.save(entity);
        Map<String, String> config = decryptConfig(saved.getConfigJsonEnc());
        return new ProviderConfigView(provider, false, maskConfig(provider, config), true);
    }

    public Optional<MerchantProviderConfig> find(UUID merchantId, PaymentProvider provider) {
        return configRepository.findByMerchantIdAndProvider(merchantId, provider)
                .map(entity -> new MerchantProviderConfig(
                        entity.getProvider(),
                        entity.isEnabled(),
                        decryptConfig(entity.getConfigJsonEnc())
                ));
    }

    private void requireMerchant(UUID merchantId) {
        merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Merchant not found"));
    }

    private ProviderSchema requireSchema(PaymentProvider provider) {
        ProviderSchema schema = SCHEMAS.get(provider);
        if (schema == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provider not supported for config: " + provider);
        }
        return schema;
    }

    private void validateRequired(PaymentProvider provider, ProviderSchema schema, Map<String, String> config) {
        List<String> missing = schema.required().stream()
                .filter(key -> config == null || config.get(key) == null || config.get(key).isBlank())
                .toList();
        if (!missing.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Missing required config values for " + provider + ": " + String.join(", ", missing)
            );
        }
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

    public record MerchantProviderConfig(
            PaymentProvider provider,
            boolean enabled,
            Map<String, String> config
    ) {}

    public record ProviderConfigView(
            PaymentProvider provider,
            boolean enabled,
            Map<String, String> config,
            boolean configurable
    ) {}

    public record ProviderConfigRequest(
            Boolean enabled,
            Map<String, String> config
    ) {}
}
