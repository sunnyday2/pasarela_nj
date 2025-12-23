/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.config;

import com.pasarela.application.MerchantAuthService;
import com.pasarela.domain.security.MerchantPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MerchantApiKeyAuthenticationFilterTest {
    @Mock
    private MerchantAuthService merchantAuthService;

    private MerchantApiKeyAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new MerchantApiKeyAuthenticationFilter(merchantAuthService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesWithPrimaryHeader() throws Exception {
        MerchantPrincipal principal = new MerchantPrincipal(UUID.randomUUID(), "demo");
        when(merchantAuthService.authenticate("primary-key")).thenReturn(Optional.of(principal));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/payment-intents");
        request.addHeader(MerchantApiKeyAuthenticationFilter.HEADER, "primary-key");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
    }

    @Test
    void authenticatesWithAliasHeader() throws Exception {
        MerchantPrincipal principal = new MerchantPrincipal(UUID.randomUUID(), "demo");
        when(merchantAuthService.authenticate("alias-key")).thenReturn(Optional.of(principal));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/payment-intents");
        request.addHeader(MerchantApiKeyAuthenticationFilter.ALIAS_HEADER, "alias-key");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
    }

    @Test
    void skipsAuthenticationWhenMissingHeaders() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/payment-intents");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNull(auth);
    }
}
