/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.persistence.repository;

import com.pasarela.domain.model.PaymentProvider;
import com.pasarela.infrastructure.persistence.entity.MerchantProviderConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantProviderConfigRepository extends JpaRepository<MerchantProviderConfigEntity, UUID> {
    List<MerchantProviderConfigEntity> findByMerchantId(UUID merchantId);

    Optional<MerchantProviderConfigEntity> findByMerchantIdAndProvider(UUID merchantId, PaymentProvider provider);
}
