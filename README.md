# pasarela-orchestrator

Monorepo demo de una **Payment Orchestration Layer** (API canónica tipo Stripe) con **smart routing (pre-routing)** y checkout **embebido tokenizado**.

## Arquitectura

- `backend/`: Java 21 + Spring Boot 3.x + SQLite (archivo local) + Flyway
- `frontend/`: Node.js 20+ + Next.js (App Router)
- `scripts/dev.*`: arranque coordinado (`npm run dev`)

## Por qué el routing es “pre-routing”

El proveedor se decide **antes** de entregar `checkoutConfig` al frontend porque **los tokens no son portables** entre Stripe y Adyen: si se re-rutea a otro proveedor, el usuario debe **re-tokenizar** (reingresar método) con el SDK del proveedor nuevo.

## Fallbacks soportados

- **Fallback instantáneo (automático)**: si falla `createSession`/`createPaymentIntent` por timeout/5xx/validación en el proveedor elegido, el backend reintenta con el otro proveedor y devuelve el `checkoutConfig` alternativo.
- **Fallback con reintento del usuario**: si el pago falla dentro del proveedor (decline/3DS fail), el backend marca `FAILED` (por webhook) y el frontend habilita **“Intentar con otro proveedor”** (`POST /api/payment-intents/{id}/reroute`), creando un nuevo intent (nuevo `id`) y un nuevo `checkoutConfig`.

## Requisitos

- Node.js 20+
- Java 21
- Maven 3.9+

## Setup rápido

1) Crear `.env`:

```bash
cp .env.example .env
```

Opcional: si el primer arranque tarda más, podés ajustar el timeout del healthcheck en ms con `BACKEND_HEALTH_TIMEOUT_MS`.

2) Instalar dependencias frontend:

```bash
cd frontend && npm install
```

3) Levantar todo:

```bash
npm run dev
```

## Dev notes

Ver `DEV.md` para Flyway repair, demo payments mode y troubleshooting de puertos.

### API base / CORS

- Por defecto el frontend llama a `/api/*` y Next.js lo proxya al backend (sin CORS).
- Si necesitás llamar directo al backend (deploy separado), seteá `NEXT_PUBLIC_API_BASE_URL` y asegurate de que `FRONTEND_BASE_URL` coincida con el origin del navegador (ej: `http://127.0.0.1:3000`).

## Webhooks (local)

### Stripe

- Configurar el endpoint `POST http://localhost:8080/api/webhooks/stripe` y setear `STRIPE_WEBHOOK_SECRET`.
- Para local, podés usar Stripe CLI para forwardear eventos al backend.

### Adyen

- Configurar notificaciones hacia `POST http://localhost:8080/api/webhooks/adyen` y setear `ADYEN_HMAC_KEY`.
- El backend verifica HMAC para cada `NotificationRequestItem`.

## Probar degradación / circuit breaker

- Simular timeouts/5xx en `createSession` seteando credenciales inválidas o bloqueando salida.
- Revisar:
  - `GET /api/admin/routing/health`
  - `routingReasonCode` en `PaymentIntent`

## Notas de seguridad (guardrails)

- El backend **nunca** recibe PAN/CVV (solo `clientSecret`/`sessionData` tokenizados).
- No se loguean secretos ni payloads sensibles; se enmascaran headers y `checkoutConfig`.
- Webhooks verifican firma (`Stripe-Signature` y HMAC Adyen).
- Idempotencia: `merchant + endpoint + Idempotency-Key`.
- Trazabilidad: `X-Request-Id` + `routingDecisionId`.

## Diagnóstico FK (Payment Intents)

- Causa raíz: se persistía `routing_decisions` antes de `payment_intents`, violando la FK `routing_decisions.payment_intent_id -> payment_intents.id`.
- Fix: se guarda primero el PaymentIntent (con flush) y luego la RoutingDecision.
- Validación rápida: crear merchant, guardar `X-Api-Key`, crear un payment intent desde `/new-payment`, o correr `mvn -f backend/pom.xml -Dtest=PaymentIntentServiceFkTest test`.
- En profile `dev`, ante violaciones FK se ejecuta `PRAGMA foreign_key_check` y se loguea `table/column/parent` junto al `requestId`.

## Licencia

Este proyecto está licenciado bajo GNU AGPLv3. Ver `LICENSE` y `NOTICE`.
