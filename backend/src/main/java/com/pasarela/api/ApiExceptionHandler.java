/*
 * Copyright (C) 2025 Pasarela Orchestrator
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package com.pasarela.api;

import com.pasarela.config.RequestIdFilter;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApi(ApiException ex) {
        return respond(ex.getStatus(), ex.getStatus().name(), ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        return respond(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    public ResponseEntity<ApiErrorResponse> handleValidation(Exception ex) {
        return respond(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid request");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        return conflict("DATA_INTEGRITY_VIOLATION", "Data integrity violation", ex);
    }

    /**
     * En algunos casos la violación aparece al hacer commit y viene envuelta así.
     */
    @ExceptionHandler(TransactionSystemException.class)
    public ResponseEntity<ApiErrorResponse> handleTransactionSystem(TransactionSystemException ex) {
        if (isIntegrityViolation(ex)) {
            return conflict("DATA_INTEGRITY_VIOLATION", "Data integrity violation", ex);
        }
        return internal(ex);
    }

    /**
     * Fallback: si algo llega como 500 pero su causa raíz es constraint (SQLite / Hibernate),
     * lo bajamos a 409 para cumplir el contrato esperado por ApiErrorHandlingTest.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleAny(Exception ex) {
        if (isIntegrityViolation(ex)) {
            return conflict("DATA_INTEGRITY_VIOLATION", "Data integrity violation", ex);
        }
        return internal(ex);
    }

    // ---------- helpers ----------

    private ResponseEntity<ApiErrorResponse> respond(HttpStatus status, String code, String message) {
        String requestId = currentRequestId();
        ApiErrorResponse body = new ApiErrorResponse(
                status.name(),
                code,
                message,
                requestId
        );
        return ResponseEntity.status(status).body(body);
    }

    private ResponseEntity<ApiErrorResponse> conflict(String code, String message, Exception ex) {
        String requestId = currentRequestId();
        log.warn("API conflict requestId={} code={} message={}", requestId, code, message, ex);
        return respond(HttpStatus.CONFLICT, code, message);
    }

    private ResponseEntity<ApiErrorResponse> internal(Exception ex) {
        String requestId = currentRequestId();
        log.error("Unhandled exception requestId={}", requestId, ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, "UNEXPECTED_ERROR", "Unexpected error");
    }

    private String currentRequestId() {
        String rid = MDC.get(RequestIdFilter.MDC_KEY);
        return (rid == null || rid.isBlank()) ? "" : rid;
    }

    /**
     * Detecta violaciones de integridad aunque vengan envueltas:
     * - Spring DataIntegrityViolationException
     * - Hibernate ConstraintViolationException
     * - SQLException con SQLITE_CONSTRAINT
     */
    private boolean isIntegrityViolation(Throwable ex) {
        Throwable t = ex;
        while (t != null) {
            if (t instanceof DataIntegrityViolationException) return true;

            // Hibernate
            if (t instanceof org.hibernate.exception.ConstraintViolationException) return true;

            // SQLite
            if (t instanceof SQLException sql) {
                String msg = sql.getMessage();
                if (msg != null && msg.contains("SQLITE_CONSTRAINT")) return true;
            }

            t = t.getCause();
        }
        return false;
    }
}
