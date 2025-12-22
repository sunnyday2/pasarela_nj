Upgrade summary and validation report

- **Upgrade target:** Spring Boot **3.5.0** (milestone approach: 3.4 → 3.5)
- **Branch:** `upgrade/spring-boot-3.5`

Changes made:
- Bumped `spring-boot-starter-parent` to `3.5.0` in `pom.xml`
- Fixed NPE when provider adapters are stubbed in tests (`ProviderAdapterRegistry.java`)
- Ensured `PaymentIntentEntity.createdAt` is set on update to satisfy DB NOT NULL constraint
- Added `rewrite.yml` as a starting point for OpenRewrite (recipe not applied)

Validation performed:
- Built successfully using JDK 21 and Maven 3.9.11
- All unit tests passed
- CVE validation: no critical CVEs found
- Behavior validation: no unexpected behavior changes detected

Artifacts:
- Upgrade summary: `.github/java-upgrade/20251222015611/summary.md`

Next steps:
- Do you want me to merge this PR now? If yes, which merge strategy do you prefer: `merge`, `squash`, or `rebase`? Reply with the strategy or `no` to keep it open for review.
