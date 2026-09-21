---
description: Crea el esqueleto de una feature en src/server/features/<dominio>/ (sin lógica)
argument-hint: <dominio en minúsculas, plural, sin acentos (ej. inscripciones)>
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(pnpm typecheck), Bash(pnpm lint), Bash(pnpm test:run), Bash(git status:*), Bash(git diff:*)
---

Crear el esqueleto de la feature **`$ARGUMENTS`** siguiendo EXACTAMENTE las reglas de `AGENTS.md`. Solo estructura: nada de lógica de negocio, endpoints, schemas de dominio ni consultas.

## 1. Validar el argumento

- Debe ser un solo identificador en minúsculas, sin espacios ni acentos (`[a-z][a-z0-9]*`). Si no lo es, o está vacío, avisar y no crear nada.
- Si `src/server/features/$ARGUMENTS/` ya existe, avisar y no sobrescribir nada.
- Leer `AGENTS.md` y usar como modelo de patrón los archivos de `src/server/features/alumnos/` (leerlos antes de generar, no de memoria) y `src/server/app.ts`.

## 2. Crear los archivos (`<d>` = `$ARGUMENTS`)

En `src/server/features/<d>/`, con el mismo contenido que los de `alumnos` reemplazando el nombre:

- `<d>.routes.ts`: importa `createRouter` de `@/server/router` y exporta `export const <d>Routes = createRouter()`. **Nunca** `new OpenAPIHono()`. Sin endpoints.
- `<d>.controller.ts`, `<d>.validation.ts`, `<d>.service.ts`, `<d>.repository.ts`: solo el comentario de responsabilidad de cada capa y `export {}`. No inventar funciones, tipos ni schemas.
- `__tests__/<d>.service.test.ts`: `describe('<d>.service', ...)` con los dos `it.todo` del modelo. Importar `describe` e `it` de `vitest`.

## 3. Registrar la feature

En `src/server/app.ts`: agregar el `import` de `<d>Routes` y **una sola línea** `app.route('/<d>', <d>Routes)` junto a las demás. No tocar nada más del archivo.

## 4. Reglas de imports que deben cumplir los archivos creados

- Solo el repository puede importar Prisma (`@/lib/prisma`, `@/generated/*`). Los demás archivos, nunca.
- Ningún archivo de la feature importa el `service`, `controller` ni `routes` de otra feature; de otra feature solo se importa su `repository` (lecturas).
- Errores desde `@/server/errors`. Nada de `process.env` (usar `@/config/env`, y solo en `lib/` o `config/`).

## 5. Verificar y reportar

- Correr `pnpm typecheck`, `pnpm lint` y `pnpm test:run` y reportar el resultado real. No corregir código ajeno a la feature nueva.
- Reportar los archivos creados y el cambio en `app.ts`.
- **No** crear ramas ni commits, **no** tocar `prisma/schema.prisma` ni generar migraciones, **no** agregar páginas ni componentes (eso se decide por separado).
