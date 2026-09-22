---
description: Revisa el diff contra main según AGENTS.md y docs/ y lista violaciones (solo lectura)
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git status:*)
---

Revisar los cambios de la rama actual contra las reglas de arquitectura del repo. **Solo lectura: no modificar archivos ni correr comandos que cambien el estado.**

## Alcance

1. Obtener los cambios con `git diff main...HEAD` (y `git diff --stat main...HEAD` para la lista de archivos). Agregar también los cambios sin commitear (`git status`, `git diff`). Si `main` no existe localmente, usar `origin/main`.
2. Leer `AGENTS.md` siempre. Según qué archivos cambiaron, leer además:
   - `docs/arquitectura-backend.md` y `docs/convenciones-backend.md`, si hay cambios en `src/server`, `src/lib`, `src/config`, `src/app/api`, `src/proxy.ts` o `prisma/`.
   - `docs/arquitectura-frontend.md`, si hay cambios en `src/app` (fuera de `api/`), `src/features`, `src/components`, `src/hooks`, `src/types` o `src/utils`.
   - `docs/contrato-api.md`, si algún cambio cruza el límite HTTP (schemas de validación, respuestas, códigos de error, tipos o `*.api.ts` del frontend).
3. Leer completo cada archivo cambiado (código, configuración y docs). Revisar solo lo que el diff introduce o modifica.

## Qué buscar

### Backend

1. **Prisma fuera de repositories:** imports de `@/lib/prisma` o `@/generated/*`, o `new PrismaClient()`, fuera de `*.repository.ts` (excepciones: `src/lib/prisma.ts` y `src/lib/auth.ts`).
2. **Dependencias entre features de API:** un archivo de una feature que importe el `service`, `controller` o `routes` de otra (por alias o por ruta relativa); un repository que importe otro repository o un service. Señalar además ciclos entre features.
3. **`try/catch` en controllers:** cualquier `try/catch` en `*.controller.ts`.
4. **Service que conoce HTTP o Prisma:** imports de `hono`, `@hono/*`, Prisma, `Response`/`Context`, o status codes numéricos en `*.service.ts`. Reglas de negocio dentro de controllers, routes o repositories. Errores lanzados que no sean `AppError` o subclases de `@/server/errors`.
5. **Repository:** errores de Prisma sin traducir (`P2002` debe convertirse en `ConflictError`); reglas de negocio dentro del repository.
6. **Routers:** `new OpenAPIHono()` u `OpenAPIHono` fuera de `src/server/router.ts` y `src/server/app.ts`. Feature nueva sin su línea `app.route(...)` en `src/server/app.ts`, o con más de una línea.
7. **Endpoints incompletos en `createRoute()`:** falta de status codes que apliquen (200/201/204 según corresponda, 400 si hay entrada validada, 401 y 403 si usa `requireAuth()`/`requireRole()`, 404 si se busca por id, 409 si puede haber conflicto), respuestas de error que no usen `ErrorResponseSchema`, endpoints sin schemas Zod de entrada, o tipos duplicados a mano en lugar de derivarlos de los schemas. Endpoint privado sin `requireAuth()` o sin `requireRole(...)`.
8. **Tests faltantes:** por cada `throw new <Error>(...)` de un `*.service.ts` cambiado, debe haber un caso en `__tests__/<dominio>.service.test.ts` que lo cubra, además del camino feliz. El repository debe estar mockeado (sin Postgres ni Docker) y los tests no deben importar `@/config/env`. Un `it.todo` no cuenta como cobertura.
9. **Fechas con `new Date()`:** `new Date()` o `Date.now()` usados para obtener "hoy" (o comparar contra hoy) en lugar de `hoy()` de `@/server/shared/fechas`. Services que dependen de "hoy" sin reloj inyectable. Fechas de calendario como `DateTime` en lugar de `@db.Date` / string `YYYY-MM-DD`. Hora guardada como texto en lugar de minutos desde medianoche.
10. **Listados sin paginación:** endpoints `GET` de colecciones sin `page`/`pageSize` (`paginacionQuerySchema`) o cuya respuesta no sea `{ data, meta }` (`paginatedSchema`); repositories con `findMany` sin `skip`/`take` ni `count`, o con orden sin `id` como desempate. Quedan exentos los selectores de catálogo y la agenda diaria.
11. **Normalización de búsqueda reimplementada:** `toLowerCase()` + `normalize('NFD')` o regex de diacríticos, `unaccent` o `mode: 'insensitive'` para buscar por nombre/apellido, fuera de `normalizarBusqueda()` de `@/server/shared/busqueda`. La búsqueda debe usar `contains` sobre la columna `busqueda`.
12. **Validaciones hechas a mano:** DNI, email, teléfono, fecha u hora validados con regex propias, `.length(...)`, `z.email()` / `z.string().email()` sueltos o similares, en lugar de `dni`, `email`, `telefono`, `fechaISO`, `horaHHmm` y `textoRequerido` de `@/server/shared/zod`.
13. **Auth y archivos:** `proxy.ts` decidiendo roles o dependiendo de módulos compartidos; MinIO/S3 usado fuera de `src/lib/storage.ts`; URLs de archivos guardadas en la base en lugar de la clave del objeto; subida directa del navegador a MinIO.

**Sobre los puntos 9 a 12 (dependen de `src/server/shared/`):** aplican como violación recién cuando esa carpeta existe. Si todavía no existe, reportar solo lo que el diff reimplementa a mano como "a confirmar: `shared/` aún no está construido" y sugerir construirlo en un PR propio, en lugar de reimplementar la lógica en la feature.

### Frontend

14. **Imports prohibidos:** cualquier archivo del frontend (`src/app` fuera de `api/`, `src/features`, `src/components`, `src/hooks`, `src/types`, `src/utils`) que importe `@/server/*`, `@/lib/*`, `@/config/*` o `@/generated/*`.
15. **Estructura:** código de una entidad fuera de `src/features/<entidad>/` (por ejemplo en `src/components/<entidad>/` o dentro de una página); `src/components/**` importando de `src/features/**`; una feature que use de otra algo que no sea `features/<otra>/hooks/*`; lógica o `fetch` dentro de archivos de `src/app/`.
16. **Llamadas a la API:** `fetch` directo fuera de `src/utils/fetch-json.ts`; URLs de `/api/v1` fuera de `src/features/*/api/`; llamadas a `/api/auth` fuera del `authClient` de `src/features/auth/`; `fetch` a otros orígenes; `useQuery`/`useMutation` sin tipar con `ApiError`; query keys escritas a mano fuera de `<entidad>.keys.ts`; mutaciones que no invalidan las keys de su entidad.
17. **Server Components:** un componente sin `'use client'` que hace `fetch` a `/api/v1` o usa hooks de TanStack Query.
18. **URLs por rol y layout:** páginas de un rol fuera de su segmento (`src/app/mesa`, `src/app/profesor`, `src/app/gerente`, `src/app/portal`); route groups usados para separar roles, o dos route groups que resuelven a la misma ruta; la correspondencia rol → segmento escrita fuera de `src/features/auth/roles.ts`; un `layout.tsx` de segmento que valida sesión o rol como si fuera seguridad; Header o Sidebar montados en `src/app/layout.tsx` o fuera de `AppShell`.
19. **Seguridad en la UI:** componentes con datos que no manejan `isError` (401/403/404); lógica que asume permiso a partir del rol del cliente (ocultar un botón está bien; saltear el manejo del 403, no); pantalla o llamada de registro público.
20. **Reglas de negocio en el frontend:** cálculo de prioridad, vigencia, capacidad, solapamientos o unicidad de DNI.
21. **Fechas en el frontend:** `new Date('YYYY-MM-DD')` o `new Date(string)` con una fecha de calendario; conversión de horas a minutos.
22. **Tipos que no siguen el contrato:** listados que no usan `PaginatedResponse<T>`; recurso individual envuelto en `{ data }`; formato de error parseado fuera de `fetchJson`.

### Transversal

23. **`process.env` disperso:** cualquier uso fuera de `src/config/env.ts` (excepción: `prisma7.config.ts`). Variable nueva que no esté a la vez en el schema de `env.ts` y en `.env.example`.
24. **Dependencias:** paquetes nuevos o quitados en `package.json` sin acuerdo o sin su cambio en `docs/dependencias.md`.
25. **Código generado:** archivos de `src/generated/` editados o agregados.
26. **Documentación desactualizada:** el diff cambia la estructura de carpetas, una regla, el contrato de la API o `eslint.config.mjs` y no actualiza el doc correspondiente (`AGENTS.md`, `docs/*`); estados temporales ("todavía no se usa") escritos en los docs.
27. **Bloque de Next:** cambios manuales dentro del bloque `nextjs-agent-rules` de `AGENTS.md`.

## Formato de la respuesta

Una lista de violaciones, ordenada por gravedad, con esta forma:

`- [regla] ruta/archivo.ts:LÍNEA — qué pasa y cómo corregirlo (una línea)`

Al final, un resumen: cantidad de violaciones por regla y los puntos dudosos marcados como "a confirmar". Si no hay violaciones, decirlo explícitamente. No inventar hallazgos: citar solo lo que se leyó en el código, con archivo y línea reales.
