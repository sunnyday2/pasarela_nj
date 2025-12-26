/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.infrastructure.provider;

import com.pasarela.config.AppProperties;
import com.pasarela.domain.model.PaymentProvider;
import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class MastercardHostedCheckoutAdapter implements PaymentProviderAdapter {
    private static final Logger log = LoggerFactory.getLogger(MastercardHostedCheckoutAdapter.class);

    private final AppProperties properties;

    public MastercardHostedCheckoutAdapter(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    public PaymentProvider provider() {
        return PaymentProvider.MASTERCARD;
    }

    @Override
    public CreateSessionResult createSession(CreateSessionCommand command) {
        Map<String, String> cfg = command.providerConfig();
        AppProperties.Providers.Mastercard fallback = properties.providers() == null ? null : properties.providers().mastercard();

        String gatewayHost = resolveConfigValue(cfg, "gatewayHost", fallback == null ? null : fallback.gatewayHost());
        String apiVersion = resolveConfigValue(cfg, "apiVersion", fallback == null ? null : fallback.apiVersion());
        String merchantId = resolveConfigValue(cfg, "merchantId", fallback == null ? null : fallback.merchantId());
        String apiPassword = resolveConfigValue(cfg, "apiPassword", fallback == null ? null : fallback.apiPassword());

        if (isBlank(gatewayHost) || isBlank(apiVersion) || isBlank(merchantId) || isBlank(apiPassword)) {
            throw new ProviderException(provider(), ProviderErrorType.VALIDATION, "Mastercard is not configured");
        }

        String baseUrl = normalizeBaseUrl(gatewayHost);
        String returnUrl = command.returnUrl();
        if (isBlank(returnUrl)) {
            String baseFrontend = properties.frontend() == null ? null : properties.frontend().baseUrl();
            if (baseFrontend == null || baseFrontend.isBlank()) baseFrontend = "http://localhost:3000";
            returnUrl = baseFrontend.replaceAll("/$", "") + "/checkout/" + command.paymentIntentId();
        }

        Map<String, Object> body = new HashMap<>();
        body.put("apiOperation", "CREATE_CHECKOUT_SESSION");
        body.put("interaction", Map.of(
                "operation", "PURCHASE",
                "returnUrl", returnUrl
        ));
        body.put("order", Map.of(
                "id", command.paymentIntentId().toString(),
                "amount", formatAmount(command.amountMinor()),
                "currency", command.currency().toUpperCase()
        ));

        String authHeader = basicAuthHeader("merchant." + merchantId, apiPassword);
        String path = "/api/rest/version/" + apiVersion + "/merchant/" + merchantId + "/session";

        try {
            Map<?, ?> resp = webClient(baseUrl).post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::is5xxServerError, res -> res.bodyToMono(String.class).flatMap(b -> Mono.error(
                            new ProviderException(provider(), ProviderErrorType.HTTP_5XX, "Mastercard 5xx"))))
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(12))
                    .block();

            if (resp == null) {
                throw new ProviderException(provider(), ProviderErrorType.UNKNOWN, "Mastercard session response invalid");
            }
            String sessionId = extractSessionId(resp);
            if (sessionId == null || sessionId.isBlank()) {
                throw new ProviderException(provider(), ProviderErrorType.UNKNOWN, "Mastercard session response missing session.id");
            }

            String successIndicator = extractSuccessIndicator(resp);
            Map<String, Object> checkoutConfig = new HashMap<>();
            checkoutConfig.put("type", "MASTERCARD");
            checkoutConfig.put("scriptUrl", baseUrl + "/checkout/version/" + apiVersion + "/checkout.js");
            checkoutConfig.put("merchantId", merchantId);
            checkoutConfig.put("sessionId", sessionId);
            checkoutConfig.put("orderId", command.paymentIntentId().toString());
            checkoutConfig.put("amount", formatAmount(command.amountMinor()));
            checkoutConfig.put("currency", command.currency().toUpperCase());
            checkoutConfig.put("returnUrl", returnUrl);
            if (successIndicator != null && !successIndicator.isBlank()) {
                checkoutConfig.put("successIndicator", successIndicator);
            }

            return new CreateSessionResult(sessionId, checkoutConfig);
        } catch (ProviderException e) {
            throw e;
        } catch (WebClientResponseException e) {
            throw mapWebClientException(e);
        } catch (Exception e) {
            throw new ProviderException(provider(), ProviderErrorType.UNKNOWN, "Mastercard request failed", e);
        }
    }

    @Override
    public RefundResult refund(RefundCommand command) {
        throw new ProviderException(provider(), ProviderErrorType.VALIDATION, "Mastercard refund not implemented");
    }

    private WebClient webClient(String baseUrl) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)
                .responseTimeout(Duration.ofSeconds(12))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(12))
                        .addHandlerLast(new WriteTimeoutHandler(12)));

        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    private ProviderException mapWebClientException(WebClientResponseException e) {
        int status = e.getRawStatusCode();
        ProviderErrorType type;
        if (status >= 500) type = ProviderErrorType.HTTP_5XX;
        else if (status == 408 || status == 504) type = ProviderErrorType.TIMEOUT;
        else type = ProviderErrorType.VALIDATION;

        log.warn("Mastercard error type={} status={}", type, status);
        return new ProviderException(provider(), type, "Mastercard request failed");
    }

    private String extractSessionId(Map<?, ?> resp) {
        Object sessionObj = resp.get("session");
        if (sessionObj instanceof Map<?, ?> session) {
            Object id = session.get("id");
            return id == null ? null : String.valueOf(id);
        }
        Object id = resp.get("sessionId");
        return id == null ? null : String.valueOf(id);
    }

    private String extractSuccessIndicator(Map<?, ?> resp) {
        Object indicator = resp.get("successIndicator");
        if (indicator != null) return String.valueOf(indicator);
        Object sessionObj = resp.get("session");
        if (sessionObj instanceof Map<?, ?> session) {
            Object nested = session.get("successIndicator");
            return nested == null ? null : String.valueOf(nested);
        }
        return null;
    }

    private String basicAuthHeader(String user, String password) {
        String token = Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
        return "Basic " + token;
    }

    private String formatAmount(long amountMinor) {
        return BigDecimal.valueOf(amountMinor, 2).setScale(2, RoundingMode.HALF_UP).toString();
    }

    private String normalizeBaseUrl(String gatewayHost) {
        String raw = gatewayHost.trim();
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            return raw.replaceAll("/$", "");
        }
        return "https://" + raw.replaceAll("/$", "");
    }

    private String resolveConfigValue(Map<String, String> cfg, String key, String fallback) {
        if (cfg != null) {
            String value = cfg.get(key);
            if (value != null && !value.isBlank()) return value;
        }
        return fallback;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
