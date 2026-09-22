---
description: Crea el esqueleto de una feature de UI en src/features/<entidad>/ (sin lógica)
argument-hint: <entidad en plural> <entidad en singular> (ej. profesores profesor)
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(pnpm check), Bash(pnpm typecheck), Bash(pnpm lint), Bash(git status:*), Bash(git diff:*)
---

Crear el esqueleto de la feature de UI **`$1`** (singular: **`$2`**) siguiendo EXACTAMENTE `AGENTS.md` y `docs/arquitectura-frontend.md`. Solo estructura: nada de campos, endpoints, reglas ni UI inventados.

## 1. Validar los argumentos

- Tienen que ser dos identificadores en minúsculas, sin espacios ni acentos (`[a-z][a-z0-9]*`): el plural (`$1`) y el singular (`$2`). Si falta alguno o no cumple, avisar y no crear nada.
- Si `src/features/$1/` ya existe, avisar y no sobrescribir nada.
- Leer `docs/arquitectura-frontend.md` y, como modelo, **todos** los archivos de `src/features/alumnos/` (leerlos antes de generar, no de memoria), `src/utils/fetch-json.ts` y `src/types/index.ts`.

## 2. Crear los archivos

En `src/features/$1/`, con el mismo contenido que los de `alumnos`, reemplazando los nombres (`alumnos` → `$1`, `alumno` → `$2`, `Alumnos` → `$1` con mayúscula inicial, `Alumno` → `$2` con mayúscula inicial):

| Modelo                        | Archivo nuevo                            |
| ----------------------------- | ---------------------------------------- |
| `alumnos.types.ts`            | `$1.types.ts`                            |
| `alumnos.schema.ts`           | `$1.schema.ts`                           |
| `api/alumnos.api.ts`          | `api/$1.api.ts`                          |
| `api/alumnos.keys.ts`         | `api/$1.keys.ts`                         |
| `hooks/use-alumnos.ts`        | `hooks/use-$1.ts`                        |
| `hooks/use-create-alumno.ts`  | `hooks/use-create-$2.ts`                 |
| `components/AlumnosTable.tsx` | `components/<$1 con mayúscula>Table.tsx` |
| `components/AlumnoForm.tsx`   | `components/<$2 con mayúscula>Form.tsx`  |

- Copiar las firmas y comentarios del modelo. **No inventar campos, tipos, URLs ni validaciones**: si el modelo tiene un tipo vacío o un TODO, el archivo nuevo lo tiene igual.
- Las URLs, si el modelo las tiene, se adaptan al dominio (`/api/v1/$1`), pero no se agregan endpoints que el modelo no tenga.

## 3. Lo que NO se hace

- No crear páginas en `src/app/` ni tocar layouts de rol, Sidebars, `AppShell` ni `proxy.ts`: qué roles ven la entidad, y bajo qué segmento, se define en la tarea de cada HU.
- No crear la feature de API: eso es `/nueva-feature-api`.
- No agregar dependencias.

## 4. Reglas de imports que deben cumplir los archivos creados

- Nada de `@/server/*`, `@/lib/*`, `@/config/*` ni `@/generated/*`.
- Solo `api/$1.api.ts` llama a la API, y siempre con `fetchJson` de `@/utils/fetch-json`.
- De otra feature solo se importan sus hooks (`@/features/<otra>/hooks/*`).
- Los hooks se tipan con `ApiError`.

## 5. Verificar y reportar

- Correr `pnpm check` y reportar el resultado real. No corregir código ajeno a la feature nueva.
- Reportar los archivos creados.
- **No** crear ramas ni commits.
