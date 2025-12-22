Summary:

- Bump Spring Boot parent to **3.5.0** (milestone approach: 3.4 → 3.5).

Changes:

- Upgrade `spring-boot-starter-parent` to `3.5.0`.
- Fix NPE when provider adapters are stubbed in tests (`ProviderAdapterRegistry`).
- Ensure `PaymentIntentEntity.createdAt` is set on update to satisfy DB constraints.
- Add `rewrite.yml` as a starting point for OpenRewrite (recipe not applied).

Validation:

- Build passes (JDK 21, Maven 3.9.11).
- All tests pass.
- CVE and behavior validations passed.

Notes:

- Branch: `upgrade/spring-boot-3.5`.
- Upgrade summary: `.github/java-upgrade/20251222015611/summary.md`
