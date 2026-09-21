---
description: Revisa el diff contra main según las reglas de AGENTS.md y lista violaciones (solo lectura)
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git status:*)
---

Revisar los cambios de la rama actual contra las reglas de arquitectura de `AGENTS.md`. **Solo lectura: no modificar archivos ni correr comandos que cambien el estado.**

## Alcance

1. Leer `AGENTS.md` (secciones "Convenciones transversales (backend)", "Reglas obligatorias", "Reglas que hace cumplir ESLint" y "Tests").
2. Obtener los cambios con `git diff main...HEAD` (y `git diff --stat main...HEAD` para la lista de archivos). Agregar también los cambios sin commitear (`git status`, `git diff`). Si `main` no existe localmente, usar `origin/main`.
3. Para cada archivo cambiado bajo `src/`, leerlo completo. Revisar solo lo que el diff introduce o modifica.

## Qué buscar

1. **Prisma fuera de repositories:** imports de `@/lib/prisma` o `@/generated/*`, o `new PrismaClient()`, fuera de `*.repository.ts` (única excepción: `src/lib/prisma.ts` y `src/lib/auth.ts`). También componentes o páginas que lleguen a Prisma o a un service.
2. **`process.env` disperso:** cualquier uso fuera de `src/config/env.ts` (excepción: `prisma7.config.ts`). Variable nueva que no esté a la vez en el schema de `env.ts` y en `.env.example`.
3. **Dependencias entre features:** un archivo de una feature que importe el `service`, `controller` o `routes` de otra (por alias o por ruta relativa). Solo se permite importar su `repository`. Señalar además ciclos entre features.
4. **`try/catch` en controllers:** cualquier `try/catch` en `*.controller.ts`.
5. **Service que conoce HTTP o Prisma:** imports de `hono`, `@hono/*`, Prisma, `Response`/`Context`, o status codes numéricos en `*.service.ts`. Reglas de negocio dentro de controllers, routes o repositories. Errores lanzados que no sean `AppError` o subclases de `@/server/errors`.
6. **Repository:** errores de Prisma sin traducir (P2002 debe convertirse en `ConflictError`); reglas de negocio dentro del repository.
7. **Routers:** `new OpenAPIHono()` u `OpenAPIHono` fuera de `src/server/router.ts` y `src/server/app.ts` (los routers se crean con `createRouter()`). Feature nueva sin su línea `app.route(...)` en `src/server/app.ts`, o con más de una línea.
8. **Endpoints incompletos en `createRoute()`:** falta de status codes que apliquen (200/201/204 según corresponda, 400 si hay entrada validada, 401 y 403 si usa `requireAuth()`/`requireRole()`, 404 si se busca por id, 409 si puede haber conflicto), respuestas de error que no usen `ErrorResponseSchema`, endpoints sin schemas Zod de entrada, o tipos duplicados a mano en lugar de derivarlos de los schemas. Endpoint privado sin `requireAuth()` o sin `requireRole(...)` cuando corresponde.
9. **Tests faltantes:** por cada `throw new <Error>(...)` de un `*.service.ts` cambiado, debe haber un caso en `__tests__/<dominio>.service.test.ts` que lo cubra, además del camino feliz. El repository debe estar mockeado (sin Postgres ni Docker) y los tests no deben importar `@/config/env`. Un `it.todo` no cuenta como cobertura.
10. **Fechas con `new Date()`:** `new Date()` o `Date.now()` usados para obtener "hoy" (o comparar contra hoy) en lugar de `hoy()` de `@/server/shared/fechas` (el servidor puede correr en UTC; la zona del negocio es `America/Argentina/Salta`). Services que dependen de "hoy" sin reloj inyectable. Fechas de calendario tratadas como `DateTime` en lugar de `@db.Date` / string `YYYY-MM-DD`. Hora guardada como texto en lugar de minutos desde medianoche.
11. **Listados sin paginación:** endpoints `GET` de colecciones de entidades sin `page`/`pageSize` (`paginacionQuerySchema`) o cuya respuesta no sea `{ data, meta }` (`paginatedSchema`); repositories con `findMany` sin `skip`/`take` ni `count`, o con orden sin `id` como desempate. Quedan exentos los selectores de catálogo (por ejemplo materias activas para un dropdown) y la agenda diaria.
12. **Normalización de búsqueda reimplementada:** `toLowerCase()` + `normalize('NFD')` o regex de diacríticos, `unaccent` o `mode: 'insensitive'` para buscar por nombre/apellido, fuera de `normalizarBusqueda()` de `@/server/shared/busqueda`. La búsqueda debe usar `contains` sobre la columna `busqueda`.
13. **Validaciones hechas a mano:** DNI, email, teléfono, fecha u hora validados con regex propias, `.length(...)`, `z.string().email()` suelto o similares en lugar de `dni`, `email`, `telefono`, `fechaISO`, `horaHHmm` y `textoRequerido` de `@/server/shared/zod`.
14. **Otras reglas de AGENTS.md:** `proxy.ts` decidiendo roles; MinIO/S3 usado fuera de `lib/storage.ts` o URLs guardadas en la base en lugar de la clave del objeto; lógica de negocio o `fetch` a algo distinto de `/api/v1` en componentes; archivos de `src/generated/` editados o agregados; dependencias nuevas en `package.json` sin acuerdo.

**Sobre los puntos 10 a 13 (dependen de `src/server/shared/`):** aplican como violación recién cuando esa carpeta existe. Si todavía no existe, reportar solo lo que el diff reimplementa a mano como "a confirmar: `shared/` aún no está construido" y sugerir construirlo en un PR propio, en lugar de reimplementar la lógica en la feature.

## Formato de la respuesta

Una lista de violaciones, ordenada por gravedad, con esta forma:

`- [regla] ruta/archivo.ts:LÍNEA — qué pasa y cómo corregirlo (una línea)`

Al final, un resumen: cantidad de violaciones por regla y los puntos dudosos marcados como "a confirmar". Si no hay violaciones, decirlo explícitamente. No inventar hallazgos: citar solo lo que se leyó en el código, con archivo y línea reales.
