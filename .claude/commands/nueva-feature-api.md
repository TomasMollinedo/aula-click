---
description: Crea el esqueleto de una feature de API en src/server/features/<dominio>/ (sin lógica)
argument-hint: <dominio en minúsculas, plural, sin acentos (ej. inscripciones)>
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(pnpm check), Bash(pnpm typecheck), Bash(pnpm lint), Bash(pnpm test:run), Bash(git status:*), Bash(git diff:*)
---

Crear el esqueleto de la feature de API **`$ARGUMENTS`** siguiendo EXACTAMENTE `AGENTS.md`, `docs/arquitectura-backend.md` y `docs/convenciones-backend.md`. Solo estructura: nada de lógica de negocio, endpoints, schemas de dominio ni consultas.

## 1. Validar el argumento

- Debe ser un solo identificador en minúsculas, sin espacios ni acentos (`[a-z][a-z0-9]*`). Si no lo es, o está vacío, avisar y no crear nada.
- Si `src/server/features/$ARGUMENTS/` ya existe, avisar y no sobrescribir nada.
- Leer `docs/arquitectura-backend.md` y usar como modelo los archivos de `src/server/features/alumnos/` (leerlos antes de generar, no de memoria) y `src/server/app.ts`.

## 2. Crear los archivos (`<d>` = `$ARGUMENTS`)

En `src/server/features/<d>/`, con el mismo contenido que los de `alumnos`, reemplazando el nombre:

- `<d>.routes.ts`: importa `createRouter` de `@/server/router` y exporta `export const <d>Routes = createRouter()`. **Nunca** `new OpenAPIHono()`. Sin endpoints.
- `<d>.controller.ts`, `<d>.validation.ts`, `<d>.service.ts`, `<d>.repository.ts`: solo comentarios y `export {}`. **No inventar funciones, tipos ni schemas.** Cada archivo lleva el comentario de responsabilidad de su capa (el de `alumnos`) más la convención transversal que le toca, escrita como comentario (lo que se implementará cuando se agreguen los endpoints):
  - `controller`: "Obtiene el Actor con `c.get('actor')` y lo pasa al service."
  - `validation`: "Los schemas de listado usan `paginacionQuerySchema` y `paginatedSchema(...)` de `@/server/shared/paginacion`."
  - `service`: "Recibe el `Actor` (`@/server/shared/actor`) y, si usa fechas, un reloj inyectable con `hoy()` de `@/server/shared/fechas` por defecto."
  - `repository`: "Expone un método de listado paginado: `findMany` y `count` en una sola transacción, orden con `id` como desempate y `calcularSkipTake` / `armarMeta` de `@/server/shared/paginacion`. Completa la auditoría (`createdById`, `updatedById`) con el Actor."
  - Las piezas de `src/server/shared/` ya existen (`docs/convenciones-backend.md` → Especificación): el esqueleto las menciona en los comentarios como las que hay que usar, sin importarlas todavía (no hay código que las use) y **sin crear funciones propias en la feature**.
- `__tests__/<d>.service.test.ts`: `describe('<d>.service', ...)` con los dos `it.todo` del modelo. Importar `describe` e `it` de `vitest`.

## 3. Registrar la feature

En `src/server/app.ts`: agregar el `import` de `<d>Routes` y **una sola línea** `app.route('/<d>', <d>Routes)` junto a las demás. No tocar nada más del archivo.

## 4. Reglas de imports que deben cumplir los archivos creados

- Solo el repository puede importar Prisma (`@/lib/prisma`, `@/generated/*`). Los demás archivos, nunca.
- Ningún archivo de la feature importa el `service`, `controller` ni `routes` de otra feature; de otra feature solo se importa su `repository` (lecturas).
- Una feature importa de `@/server/shared/*` (nunca al revés) y no reimplementa nada de lo que está ahí.
- Dentro de la feature, los imports entre sus propios archivos son relativos (`./<d>.service`, `../<d>.service` desde `__tests__`).
- Errores desde `@/server/errors`.
- Nada de `process.env` ni de `@/config/env` en la feature (la configuración se usa solo en `src/lib/` y `src/config/`).

## 5. Verificar y reportar

- Correr `pnpm check` y reportar el resultado real. No corregir código ajeno a la feature nueva.
- Reportar los archivos creados y el cambio en `app.ts`.
- Recordar que la feature de UI equivalente, si hace falta, se crea aparte con `/nueva-feature-ui`.
- **No** crear ramas ni commits, **no** tocar `prisma/schema.prisma` ni generar migraciones, **no** agregar páginas ni componentes (eso se decide por separado).
