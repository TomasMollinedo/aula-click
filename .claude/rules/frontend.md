---
paths:
  - "src/app/**"
  - "src/features/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/types/**"
  - "src/utils/**"
  - "src/proxy.ts"
---

# Frontend

Esta zona es el frontend. **Excepción:** `src/app/api/**` son adaptadores del backend y siguen `.claude/rules/backend.md`.

Si en esta sesión todavía no se leyeron, leer antes de escribir código:

- `docs/arquitectura-frontend.md` — siempre.
- `docs/contrato-api.md` — si la tarea consume la API (tipos, paginación, errores, fechas).
- `docs/dominio.md` — si la tarea muestra o valida reglas de negocio.

Checklist (resumen; la fuente es `docs/arquitectura-frontend.md`):

- Todo lo de una entidad va en `src/features/<entidad>/`. Feature de UI nueva: `/nueva-feature-ui <plural> <singular>`, con `src/features/alumnos/` como modelo.
- `app/` solo enruta y compone. `components/` es UI sin entidad y no importa de `features/`. De otra feature solo se usan sus hooks (`features/<otra>/hooks/*`).
- Nada del frontend importa `@/server`, `@/lib`, `@/config` ni `@/generated`.
- Todo pedido a `/api/v1` pasa por `fetchJson`, dentro de `features/<entidad>/api/`. Los componentes usan los hooks de TanStack Query de su feature, tipados con `ApiError`. Login, logout y sesión, solo con el `authClient` de `features/auth/`.
- Los componentes que piden datos son Client Components. Ningún Server Component hace `fetch` a `/api/v1`.
- Cada rol vive bajo su segmento de URL (`/mesa`, `/profesor`, `/gerente`, `/portal`). La pantalla de una entidad para un rol va en `app/<segmento>/<entidad>/` y compone componentes de la feature; no se usan route groups para separar roles.
- `components/` no importa de `features/`: lo que depende de una feature (por ejemplo `UserMenu` en el Header) le llega por props desde el layout del segmento.
- El rol que ve la UI solo muestra u oculta cosas. Cada componente con datos maneja 401/403/404 con su propia UI.
- Las fechas de calendario son strings `YYYY-MM-DD`: nunca `new Date('YYYY-MM-DD')`. Prioridad, vigencia, capacidad y solapamientos los calcula la API, no el frontend.
