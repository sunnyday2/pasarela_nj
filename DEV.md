# DEV

## Flyway checksum mismatch (SQLite)

Si el archivo de migracion `backend/src/main/resources/db/migration/V1__init.sql` cambia despues de haberse aplicado,
Flyway valida checksums y puede fallar al iniciar con `Migration checksum mismatch`.

### Solucion dev-safe

En el profile `dev` se habilita `pasarela.flyway.auto-repair=true`, que ejecuta `Flyway.repair()` antes de `migrate()`.
Eso actualiza el checksum en `flyway_schema_history` sin borrar datos.

Para activar el profile:

```bash
SPRING_PROFILES_ACTIVE=dev ./mvnw -f backend/pom.xml spring-boot:run
```

Tambien podes habilitar el repair por flag sin usar el profile:

```bash
PASARELA_FLYWAY_AUTO_REPAIR=true ./mvnw -f backend/pom.xml spring-boot:run
```

### Reset de DB en dev (si queres empezar de cero)

Detene el backend y borra la DB local:

```bash
rm backend/data/pasarela.db
```

Al reiniciar, Flyway recrea las tablas desde cero.
