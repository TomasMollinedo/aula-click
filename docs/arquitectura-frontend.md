# Arquitectura del frontend — Aula Click

Cómo está armado el frontend y qué reglas sigue. Lo que se acuerda con el backend (URLs, formatos, paginación, errores) está en [`contrato-api.md`](./contrato-api.md). Las reglas transversales y las de ESLint, en `AGENTS.md`.

## Stack

- **Next.js 16** (App Router) + **React**.
- **TanStack Query**: datos del servidor en el cliente (cache, reintentos, invalidación).
- **react-hook-form** + **`@hookform/resolvers`** (`zodResolver`) + **Zod**: formularios.
- **Tailwind CSS v4** + `utils/cn.ts` (`clsx` + `tailwind-merge`).
- **lucide-react**: íconos. **date-fns**: fechas.
- **`better-auth/react`**: cliente de autenticación (viene dentro del paquete `better-auth`; no es una dependencia aparte).

## Cada carpeta cumple una única función

| Carpeta                      | Función                                                                                                                                                    | No hace                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app/`                       | Enrutar. Cada archivo define una URL o un layout que envuelve URLs                                                                                         | Lógica de negocio ni `fetch` propio: solo importa y compone lo de `features/` y `components/` |
| `features/<entidad>/`        | Toda la lógica y la UI de **una entidad del dominio** (alumno, profesor, turno…): tipos, validación de formularios, llamadas a la API, hooks y componentes | Usar internals de otra entidad: de otra feature solo se usan sus hooks                        |
| `components/`                | Piezas de UI que **no pertenecen a ninguna entidad**: primitivos (`ui/`) y esqueleto de la app (`layout/`)                                                 | Importar de `features/`                                                                       |
| `hooks/`, `types/`, `utils/` | Utilidades genéricas (un hook de debounce, el tipo de paginación, el helper de clases CSS, `fetchJson`)                                                    | Nada específico de una entidad: eso va adentro de la feature                                  |
| `app/api/`                   | **Backend.** Adaptadores de Hono y Better Auth                                                                                                             | No se toca desde el frontend                                                                  |
| `lib/`, `server/`, `config/` | **Backend.** Ver `arquitectura-backend.md`                                                                                                                 | El frontend tiene prohibido importarlos (ESLint)                                              |

## Quién importa a quién

```
app/                  → features/, components/, hooks/, types/, utils/
features/<X>/         → components/, hooks/, types/, utils/, y features/<Y>/hooks/* (solo hooks de otra feature)
components/           → hooks/, types/, utils/            (nunca features/)
hooks/, types/, utils/ → entre sí                          (nunca features/ ni components/)
nadie del frontend    → server/, lib/, config/, generated/ (ESLint)
```

Ejemplo: el formulario de turno necesita un selector de alumnos. `TurnoForm.tsx` usa el hook `use-alumnos` de `features/alumnos/hooks/`; no llama a `alumnos.api.ts` ni importa `AlumnosTable`.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                      # layout raíz: solo <Providers> (sin Header ni Sidebar)
│   ├── providers.tsx                   # QueryClientProvider (TanStack Query)
│   ├── page.tsx                        # inicio "/" (protegida por proxy.ts)
│   ├── login/page.tsx                  # pública; fuera de todo route group; usa features/auth
│   ├── (personal-mesa-entradas)/
│   │   ├── layout.tsx                  # <AppShell sidebar={<PersonalMesaEntradasSidebar />}>
│   │   ├── alumnos/
│   │   │   ├── page.tsx                # listado
│   │   │   ├── nuevo/page.tsx          # alta
│   │   │   └── [alumnoId]/page.tsx     # edición
│   │   ├── profesores/page.tsx
│   │   ├── materias/page.tsx
│   │   ├── turnos/page.tsx
│   │   └── calendario/page.tsx
│   └── api/                            # BACKEND (adaptadores); no se toca desde el frontend
│
├── features/
│   ├── auth/                           # A construir
│   │   ├── auth-client.ts              # createAuthClient() de better-auth/react
│   │   └── components/LoginForm.tsx
│   └── alumnos/                        # modelo de nombres y firmas para las demás entidades
│       ├── alumnos.types.ts
│       ├── alumnos.schema.ts
│       ├── api/{alumnos.api.ts, alumnos.keys.ts}
│       ├── hooks/{use-alumnos.ts, use-create-alumno.ts}
│       └── components/{AlumnosTable.tsx, AlumnoForm.tsx}
│
├── components/
│   ├── ui/                             # primitivos de UI hechos a mano (D-08)
│   └── layout/
│       ├── app-shell.tsx               # A construir: Header + Sidebar + contenido
│       ├── header.tsx                  # A construir: logo, menú de usuario, logout
│       └── personal-mesa-entradas-sidebar.tsx
│
├── hooks/use-debounce.ts
├── types/index.ts                      # PaginatedResponse<T>, Role (provisorio, D-01)
└── utils/{cn.ts, fetch-json.ts}
```

## Anatomía de una feature de UI

| Archivo                                     | Responsabilidad                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `<entidad>.types.ts`                        | Tipos de lo que la API recibe y devuelve para esta entidad, según el OpenAPI y `contrato-api.md` (D-07) |
| `<entidad>.schema.ts`                       | Schemas Zod de los formularios de la entidad                                                            |
| `api/<entidad>.api.ts`                      | Funciones que llaman a `/api/v1` con `fetchJson`. Es el único archivo de la entidad que conoce URLs     |
| `api/<entidad>.keys.ts`                     | Query keys de TanStack Query de la entidad (fábrica de keys)                                            |
| `hooks/use-<entidad>.ts`                    | `useQuery` de listado o detalle                                                                         |
| `hooks/use-create-<singular>.ts` (y afines) | `useMutation` que, al terminar bien, invalida las keys de la entidad                                    |
| `components/`                               | Componentes de la entidad (`<Entidad>Table.tsx`, `<Singular>Form.tsx`…)                                 |

Nombres: archivos que no son componentes en kebab-case (`use-create-alumno.ts`); componentes en PascalCase (`AlumnoForm.tsx`). La feature va en plural (`alumnos`); lo que representa un solo objeto va en singular (`AlumnoForm`, `use-create-alumno`). `features/alumnos/` es la referencia de nombres y firmas. Una feature nueva se crea con `/nueva-feature-ui <plural> <singular>` (Claude Code) o copiando `alumnos` a mano.

## Roles y route groups

| Rol                          | Route group                | Estado             |
| ---------------------------- | -------------------------- | ------------------ |
| Personal de mesa de entradas | `(personal-mesa-entradas)` | Existe             |
| Profesor                     | `(profesor)`               | Planificado        |
| Gerente                      | `(gerente)`                | Planificado        |
| Alumno                       | `(portal)`                 | A confirmar (D-02) |

- Un route group agrupa páginas para compartir un layout (su Sidebar). **No valida sesión ni rol** y **no aparece en la URL**: `(personal-mesa-entradas)/alumnos/page.tsx` se sirve en `/alumnos`.
- Por eso, **dos route groups nunca pueden definir la misma ruta**. Si existieran `(profesor)/calendario/page.tsx` y `(personal-mesa-entradas)/calendario/page.tsx`, las dos responderían en `/calendario` y el build falla.
- Cómo se separan las URLs por rol es la decisión abierta **D-06**. Se resuelve antes de crear el segundo route group de rol.
- Los nombres de route group son slugs de la UI. El valor técnico del rol en la API está pendiente (D-01); el tipo `Role` de `types/index.ts` es provisorio hasta entonces.

## Layout: Sidebar y Header

- `app/layout.tsx` (raíz) solo monta `<Providers>`. No lleva Header: si lo llevara, también aparecería en `/login`.
- `components/layout/app-shell.tsx` (**A construir**) arma el esqueleto de la app autenticada: Header arriba, Sidebar al costado y el contenido. Recibe el Sidebar por prop.
- El `layout.tsx` de cada route group de rol monta `<AppShell sidebar={<PersonalMesaEntradasSidebar />}>{children}</AppShell>`.
- **Sidebar:** uno por rol, en `components/layout/<rol>-sidebar.tsx`, porque cada rol navega a pantallas distintas.
- **Header:** uno solo para todos los roles, en `components/layout/header.tsx` (logo, menú de usuario, logout).

## Datos: Server y Client Components

- Las páginas de `app/` pueden ser Server Components, pero **solo componen**: renderizan componentes de `features/` y `components/`.
- Todo componente que pide o modifica datos es Client Component (`'use client'`) y usa los hooks de su feature.
- **Ningún Server Component hace `fetch` a `/api/v1`**: en el servidor una URL relativa no funciona y la cookie de sesión no viaja. Si alguna vez hace falta renderizar datos en el servidor, se decide aparte.
- Páginas dinámicas (`[alumnoId]/page.tsx`): en Next 16 `params` es una `Promise`. Confirmar en `node_modules/next/dist/docs/` cómo leerlo en Server y en Client Components.
- Los datos del servidor viven en la cache de TanStack Query; no se copian a `useState`. El estado de UI (filtros, modal abierto) es local y se sube solo lo necesario: datos hacia abajo por props, eventos hacia arriba.

## Llamadas a la API: `fetchJson` y `ApiError`

- `src/utils/fetch-json.ts` es el **único** lugar que interpreta la respuesta de error de la API (`{ error: { code, message, details? } }`) y la convierte en un `ApiError` con `status`, `code` y `details`.
- Cada `<entidad>.api.ts` llama a `fetchJson<T>(...)` en lugar de repetir el parseo. No hay `fetch` directo en componentes, hooks ni páginas, ni `fetch` a otros orígenes.
- Los hooks se tipan con el error: `useQuery<TData, ApiError>(...)` y `useMutation<TData, ApiError, TVariables>(...)`, para tener `error.status` y `error.code` sin cast.
- Las query keys salen solo de `<entidad>.keys.ts`. Una mutación invalida las keys de su entidad.
- Los tipos siguen el contrato: los listados son `PaginatedResponse<T>` (`{ data, meta }`) y el recurso individual viene directo.

## Manejo de errores en la UI

`proxy.ts` solo garantiza que hay una cookie; no que la sesión sea válida ni que el rol alcance. Por eso cada componente con datos maneja `isError` con su propia UI y no asume que, si la página cargó, el usuario tiene permiso.

| Caso               | Qué hace la UI                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400 `VALIDACION`   | En formularios, marca cada campo con su mensaje (`setError` a partir de `details`). Fuera de un formulario, muestra `message`                    |
| 401                | Sesión vencida o inválida: redirige a `/login`. Se centraliza en `providers.tsx` (`onError` de `QueryCache` y `MutationCache`) — **A construir** |
| 403                | Mensaje de "sin permiso" en el lugar del contenido; no redirige                                                                                  |
| 404                | Estado de "no encontrado"                                                                                                                        |
| 409                | Muestra `message`. Si el `code` es específico (por ejemplo `BLOQUE_LLENO`), usa `details` (por ejemplo, lista las fechas llenas)                 |
| 500 o error de red | Mensaje genérico con opción de reintentar                                                                                                        |

## Autenticación en el cliente

- `features/auth/auth-client.ts` (**A construir**) crea el cliente con `createAuthClient` de `better-auth/react`. Verificar la API exacta en la versión instalada.
- Login: `authClient.signIn.email(...)` desde `LoginForm` (en `/login`). Logout: `authClient.signOut()` desde el Header. Sesión y rol para la UI: `authClient.useSession()`.
- No se importa `@/lib/auth`: es la instancia del servidor y ESLint lo bloquea. Para que `role` salga tipado en el cliente, se declara del lado del cliente (plugin `inferAdditionalFields` con el campo `role`), sin importar tipos del servidor.
- El rol en el cliente solo sirve para mostrar u ocultar navegación y acciones. La seguridad es la API.
- No hay pantalla de registro: los usuarios los crea un gerente.

## Formularios

- `react-hook-form` + `zodResolver`, con el schema de la feature (`<entidad>.schema.ts`, usando el `z` de `zod`).
- Los schemas del frontend no se comparten con el backend (T-08). Replican las reglas de **formato** del contrato (DNI de 7 u 8 dígitos aceptando puntos, email, teléfono, fechas `YYYY-MM-DD`, horas `HH:mm`) para dar feedback inmediato. La validación que manda es la de la API, y sus 400 se muestran en los campos.
- Nada de reglas de negocio en el frontend: DNI duplicado, solapamientos, capacidad, prioridad y vigencia los decide la API.

## Fechas y horas

- Una fecha de calendario es un string `YYYY-MM-DD` en todo el frontend: se recibe y se envía así.
- **Nunca `new Date('YYYY-MM-DD')`**: JavaScript lo interpreta como medianoche UTC, y en Argentina (UTC−3) se muestra el día anterior. Para mostrar o calcular, `parseISO` y `format` de `date-fns` (`parseISO` interpreta una fecha sin hora como hora local).
- Las horas son strings `HH:mm`; el frontend no las convierte a minutos (eso es del backend).
- Los instantes de auditoría (`createdAt`, `updatedAt`) llegan en ISO 8601 UTC y se formatean con `date-fns` para mostrarlos en hora local.
- Para proponer "hoy" en un selector (por ejemplo la agenda), se usa la fecha local del navegador con `format(new Date(), 'yyyy-MM-dd')`. Qué es "hoy" para las reglas lo decide la API.

## Estilos y UI

- Tailwind v4. Las clases condicionales se arman con `cn()` de `utils/cn.ts`.
- `components/ui/`: primitivos hechos a mano, con la misma API que tendrían en shadcn/ui por si se adopta después (D-08).
- Íconos: `lucide-react`.

## Tests

El alcance de los tests de frontend es la decisión abierta D-09. Hasta decidirlo, los tests automatizados cubren solo el backend (`pnpm test:run`).
