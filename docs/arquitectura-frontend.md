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
app/                   → features/, components/, hooks/, types/, utils/
features/<X>/          → components/, hooks/, types/, utils/, y features/<Y>/hooks/* (solo hooks de otra feature)
components/            → hooks/, types/, utils/            (nunca features/: ESLint)
hooks/, types/, utils/ → entre sí                          (nunca features/ ni components/: ESLint)
nadie del frontend     → server/, lib/, config/, generated/ (ESLint, con alias o con ruta relativa)
```

Ejemplo: el formulario de turno necesita un selector de alumnos. `TurnoForm.tsx` usa el hook `use-alumnos` de `features/alumnos/hooks/`; no llama a `alumnos.api.ts` ni importa `AlumnosTable`.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                      # layout raíz: solo <Providers> (sin Header ni Sidebar)
│   ├── providers.tsx                   # QueryClientProvider (TanStack Query)
│   ├── page.tsx                        # "/": redirige al segmento del rol de la sesión
│   ├── login/page.tsx                  # pública; usa features/auth
│   ├── mesa/                           # rol MESA_ENTRADAS → /mesa/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<MesaSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /mesa/alumnos
│   │   ├── alumnos/
│   │   │   ├── layout.tsx              # {children} + {modal}
│   │   │   ├── page.tsx                # listado (q y page en la URL)
│   │   │   ├── nuevo/page.tsx          # alta, entrando por URL (página)
│   │   │   ├── [alumnoId]/
│   │   │   │   ├── page.tsx            # detalle, entrando por URL
│   │   │   │   └── editar/page.tsx     # edición, entrando por URL
│   │   │   └── @modal/                 # las mismas tres, como modal sobre el listado
│   │   │       ├── default.tsx         # null: sin modal al cargar por URL
│   │   │       ├── page.tsx            # null: cierra el modal al volver al listado con un Link
│   │   │       ├── (.)nuevo/page.tsx
│   │   │       └── (.)[alumnoId]/{page.tsx, editar/page.tsx}
│   │   ├── profesores/page.tsx
│   │   ├── materias/page.tsx
│   │   ├── turnos/page.tsx
│   │   └── calendario/page.tsx
│   ├── profesor/                       # rol PROFESOR → /profesor/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<ProfesorSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /profesor/agenda
│   │   ├── agenda/page.tsx
│   │   └── alumnos/page.tsx
│   ├── gerente/  portal/               # se crean con las HU de cada rol (portal: Sprint 3)
│   └── api/                            # BACKEND (adaptadores); no se toca desde el frontend
│
├── features/
│   ├── auth/
│   │   ├── auth-client.ts              # createAuthClient() de better-auth/react
│   │   ├── auth.schema.ts              # schema Zod del formulario de login
│   │   ├── roles.ts                    # rol → segmento de URL (único lugar con esa correspondencia)
│   │   ├── codigos-error.ts            # codes del contrato que el frontend reconoce
│   │   ├── interpretar-error-login.ts  # único lugar que decide el mensaje de un login fallido
│   │   ├── sesion-expirada.ts          # los motivos en la URL de /login, compartidos con providers.tsx
│   │   └── components/{LoginForm.tsx, UserMenu.tsx, AvisoSesionExpirada.tsx, SegmentoDeRol.tsx}
│   └── alumnos/                        # modelo de nombres y firmas para las demás entidades
│       ├── alumnos.types.ts
│       ├── alumnos.schema.ts            # schema Zod del formulario + funciones de conversión form↔API
│       ├── edad.ts                      # "menor de edad" en el formulario: solo ayuda visual (ver Formularios)
│       ├── errores-api.ts               # helper: mapea ApiError a errores del formulario
│       ├── api/{alumnos.api.ts, alumnos.keys.ts}
│       ├── hooks/{use-alumnos.ts, use-alumno.ts, use-crear-alumno.ts, use-editar-alumno.ts, use-buscador-alumnos.ts}
│       └── components/
│           ├── AlumnosListado.tsx, AlumnosTable.tsx, BuscadorAlumnos.tsx, SinResultados.tsx, TotalAlumnos.tsx
│           ├── AlumnoNuevo.tsx, AlumnoDetalle.tsx, AlumnoEditar.tsx   # pantallas en un <Panel> (modal o página)
│           └── AlumnoForm.tsx, AlumnoPanelEstado.tsx, AvisoMenorDeEdad.tsx, BotonNuevoAlumno.tsx
│
├── components/
│   ├── ui/                             # primitivos de UI hechos a mano (D-08/T-26)
│   └── layout/
│       ├── app-shell.tsx               # columna del Sidebar (logo + nav + usuario) + contenido
│       ├── page-header.tsx             # título, descripción y acción principal de cada pantalla
│       ├── sidebar-logo.tsx            # isotipo + wordmark, arriba de la columna (no es un link)
│       ├── sidebar-nav.tsx             # nav genérico (label + links con ícono); lo usan los de abajo
│       └── {mesa,profesor}-sidebar.tsx # uno por rol: <segmento>-sidebar.tsx, con sus propios links
│
├── hooks/use-debounce.ts
├── types/index.ts                      # PaginatedResponse<T>, Role
└── utils/{cn.ts, fetch-json.ts, page-range.ts, initials.ts}
```

## Anatomía de una feature de UI

| Archivo                                    | Responsabilidad                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<entidad>.types.ts`                       | Tipos de lo que la API recibe y devuelve para esta entidad, según el OpenAPI y `contrato-api.md` (D-07)                                                                                                                                                                                                                                                                                                                                                             |
| `<entidad>.schema.ts`                      | Schemas Zod de los formularios de la entidad                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `api/<entidad>.api.ts`                     | Funciones que llaman a `/api/v1` con `fetchJson`. Es el único archivo de la entidad que conoce URLs                                                                                                                                                                                                                                                                                                                                                                 |
| `api/<entidad>.keys.ts`                    | Query keys de TanStack Query de la entidad (fábrica de keys)                                                                                                                                                                                                                                                                                                                                                                                                        |
| `hooks/use-<entidad>.ts`                   | `useQuery` de listado o detalle                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `hooks/use-crear-<singular>.ts` (y afines) | `useMutation` que, al terminar bien, invalida las keys de la entidad                                                                                                                                                                                                                                                                                                                                                                                                |
| `hooks/use-buscador-<entidad>.ts`          | Hook reutilizable de búsqueda: texto, debounce, paginación, delegado al hook de listado. El debounce es propio (no `hooks/use-debounce.ts`): al sincronizarse con la URL tiene que poder fijar `q` al instante, y con un valor debounceado atrasado volvería a escribir la búsqueda vieja en la URL. Acepta estado controlado (q, page, onCambio) para que la página maneje la URL, o estado interno para otros consumidores (por ejemplo, el formulario de turnos) |
| `errores-api.ts`                           | Helpers que mapean un `ApiError` a errores del formulario y/o error general: `interpretarErroresApi` (pura, se puede usar en el render) y `aplicarErroresApi` (hace el `setError` y pone el foco). Verifican que el `path` sea un campo válido del schema antes de marcar el campo                                                                                                                                                                                  |
| `components/`                              | Componentes de la entidad (`<Entidad>Table.tsx`, `<Singular>Form.tsx`…). Las pantallas de alta, detalle y edición son `<Singular>Nuevo.tsx`, `<Singular>Detalle.tsx` y `<Singular>Editar.tsx`: piden sus datos, se arman con `Panel` y reciben `mode` y los callbacks de navegación (`onCerrar`, `onCreado`, `onGuardado`) desde la página (ver Modales con URL propia)                                                                                             |

Nombres: archivos que no son componentes en kebab-case (`use-crear-alumno.ts`); componentes en PascalCase (`AlumnoForm.tsx`). La feature va en plural (`alumnos`); lo que representa un solo objeto va en singular (`AlumnoForm`, `use-crear-alumno`). `features/alumnos/` es la referencia de nombres y firmas. Una feature nueva se crea con `/nueva-feature-ui <plural> <singular>` (Claude Code) o copiando `alumnos` a mano.

## Roles y URLs

Cada rol tiene su propio segmento de URL (decisión T-19). Todas sus pantallas cuelgan de ese segmento y comparten su layout.

| Rol              | `role` en la API | Segmento    | Layout y Sidebar                                   | Estado      |
| ---------------- | ---------------- | ----------- | -------------------------------------------------- | ----------- |
| Mesa de entradas | `MESA_ENTRADAS`  | `/mesa`     | `app/mesa/layout.tsx` + `mesa-sidebar.tsx`         | Sprint 1    |
| Profesor         | `PROFESOR`       | `/profesor` | `app/profesor/layout.tsx` + `profesor-sidebar.tsx` | Sprint 1    |
| Gerente          | `GERENTE`        | `/gerente`  | `app/gerente/layout.tsx` + `gerente-sidebar.tsx`   | Planificado |
| Alumno           | `ALUMNO`         | `/portal`   | `app/portal/layout.tsx` + `portal-sidebar.tsx`     | Sprint 3    |

- Cada segmento tiene su `page.tsx` en la raíz, que lleva a la primera pantalla del rol: ahí es donde caen el login y `/`, así que sin esa página serían un 404.
- La pantalla de una entidad para un rol va en `app/<segmento>/<entidad>/`. Si dos roles ven la misma entidad (por ejemplo, turnos), cada uno tiene su página (`/mesa/turnos`, `/profesor/turnos`) y las dos componen los mismos componentes de `features/turnos/`. La lógica no se duplica: vive en la feature.
- Por eso los componentes de una feature **no escriben el segmento del rol en sus links**: la página les pasa `rutaBase` (la URL del listado de la entidad en su segmento, por ejemplo `rutaBase="/mesa/alumnos"`) y el componente arma el resto (`${rutaBase}/nuevo`, `${rutaBase}/<id>`, `${rutaBase}/<id>/editar`).
- El segmento **no es seguridad**. El layout de cada rol monta `features/auth/components/SegmentoDeRol.tsx`, que manda al usuario al segmento de su propio rol: es comodidad de navegación, no un control de acceso, y sin sesión no hace nada. Lo que decide de verdad es el 403 de la API, que cada componente con datos muestra igual.
- La correspondencia rol → segmento vive en un solo lugar: `features/auth/roles.ts`. La usan `/` (que lee la sesión con `authClient.useSession()` y redirige al segmento del rol), `SegmentoDeRol` y el login. `GERENTE` y `ALUMNO` no tienen segmento todavía: para ellos la correspondencia es `null` y `/` muestra un aviso en lugar de mandarlos a un 404.
- No se usan route groups para separar roles. Si alguna vez se usan para otra cosa (compartir un layout sin cambiar la URL), dos route groups nunca pueden definir la misma ruta: los paréntesis no aparecen en la URL y el build falla.

## Layout: Sidebar

No hay una barra de Header separada: todo lo fijo de la app autenticada vive en una única columna (el Sidebar), y el contenido de la pantalla ocupa el resto.

- `app/layout.tsx` (raíz) solo monta `<Providers>`. No lleva el Sidebar: si lo llevara, también aparecería en `/login`.
- `components/layout/app-shell.tsx` arma esa columna, de arriba a abajo: `SidebarLogo` (isotipo, fijo), el `sidebar` que recibe por props (nav del rol, con scroll propio si no entra) y el `userMenu` que recibe por props (fijo, abajo, separado por un borde). El contenido va a la derecha.
- El `layout.tsx` de cada segmento de rol monta `<AppShell sidebar={<MesaSidebar />} userMenu={<UserMenu />}>{children}</AppShell>`.
- **`sidebar-logo.tsx`:** isotipo + "AulaClick", uno solo para todos los roles. No es un link: no hay una pantalla propia de "/" para un usuario logueado (`/` solo redirige según el rol).
- **`sidebar-nav.tsx`:** el nav genérico (una lista de `{ href, label, icon }` con el estado activo resuelto por `usePathname`). Lo usan `mesa-sidebar.tsx` y `profesor-sidebar.tsx`, que solo aportan su propio array de links y el título de sección; evita repetir la lógica de estado activo entre roles sin dejar de tener "un archivo por rol" (`<segmento>-sidebar.tsx`) como pide la tabla de arriba.
- **Menú de usuario** (avatar, nombre, rol y un menú con "Cerrar sesión"): `features/auth/components/UserMenu.tsx`. `components/` no puede importar de `features/` (ESLint), así que todo lo que depende de una feature le llega a `AppShell` por props, armado en el layout del segmento.

## Datos: Server y Client Components

- Las páginas de `app/` pueden ser Server Components, pero **solo componen**: renderizan componentes de `features/` y `components/`.
- Todo componente que pide o modifica datos es Client Component (`'use client'`) y usa los hooks de su feature.
- **Ningún Server Component hace `fetch` a `/api/v1`**: en el servidor una URL relativa no funciona y la cookie de sesión no viaja. Si alguna vez hace falta renderizar datos en el servidor, se decide aparte.
- Páginas dinámicas (`[alumnoId]/page.tsx`): en Next 16 `params` es una `Promise`. Confirmar en `node_modules/next/dist/docs/` cómo leerlo en Server y en Client Components.
- Los layouts y las páginas se tipan con los tipos que genera `next typegen` (`LayoutProps<'/mesa'>`, `PageProps<...>`), no con interfaces escritas a mano: `pnpm typecheck` los regenera antes de `tsc`.
- Un Client Component que usa `useSearchParams` va envuelto en `<Suspense>` donde se monta (así se monta `AvisoSesionExpirada` en `/login`); sin eso falla el build de producción.
- Los datos del servidor viven en la cache de TanStack Query; no se copian a `useState`. El estado de UI (filtros, modal abierto) es local y se sube solo lo necesario: datos hacia abajo por props, eventos hacia arriba.

## Filtros del listado en la URL

Los filtros de un listado paginado (`q`, `page`) se guardan en la URL (`?q=…&page=…`) con `router.replace`, para que el botón Atrás del navegador conserve la búsqueda y la página. El patrón:

- La página del listado es un Server Component que envuelve en `<Suspense>` un Client Component (por ejemplo `AlumnosListado`).
- Ese Client Component lee `q` y `page` con `useSearchParams` (una `page` que no sea un entero >= 1 se toma como 1) y llama a `router.replace` solo cuando el `q` debounceado o la `page` cambian, evitando un replace por cada tecla.
- Si la URL cambia desde afuera (Atrás, o un clic en "Alumnos" del Sidebar), el buscador se sincroniza con ella: el texto del input y la página pasan a ser los de la URL.
- Escribir en el buscador vuelve a la página 1.
- El hook `use-buscador-<entidad>` acepta un estado controlado (`{ q, page, onCambio }`) para este caso, o estado interno para otros consumidores (por ejemplo, un selector de alumnos en el formulario de turnos que no necesita persistir en la URL).

## Modales con URL propia

Alta, detalle y edición de una entidad se abren **como modal encima del listado** cuando se llega navegando desde él, y **como página** cuando se entra por URL o se recarga. Las URLs son las mismas en los dos casos (`/mesa/alumnos/nuevo`, `/mesa/alumnos/12`, `/mesa/alumnos/12/editar`), así que se pueden compartir y otras features pueden enlazarlas. Es el patrón de Next de Parallel + Intercepting Routes (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md` → Modals); `alumnos` es el modelo:

- `app/<segmento>/<entidad>/layout.tsx` renderiza `{children}` y el slot `{modal}` (tipado con `LayoutProps`, que ya trae `modal`).
- `@modal/(.)nuevo/page.tsx` y `@modal/(.)[id]/…` interceptan la navegación desde el listado y muestran el componente de la feature con `mode="modal"`. `@modal/default.tsx` y `@modal/page.tsx` devuelven `null`: el primero para la carga por URL y el segundo para que un `Link` al listado (por ejemplo, el del Sidebar) cierre el modal.
- `nuevo/page.tsx` y `[id]/…/page.tsx` son la versión de página: `PageHeader` + el mismo componente con `mode="page"`.
- Cada pantalla de la feature (`AlumnoNuevo`, `AlumnoDetalle`, `AlumnoEditar`) es la misma en los dos modos: se arma con `Panel` de `components/ui/` y **no navega sola**. La página le pasa qué hacer al cerrar o al guardar:
  - **Modal:** cerrar es `router.back()` (vuelve al listado con su `q` y su `page`); tras un alta, `router.replace` al detalle, así Atrás vuelve al listado y no al alta.
  - **Página:** cerrar o guardar va al listado con `router.push`. Ir a otra ruta de la entidad desde una página la abriría como modal encima de esa página, porque la intercepción vale para toda navegación dentro del layout de la entidad.
- El modal de un formulario no se cierra con un clic afuera (`dismissOnInteractOutside={false}`), para no perder lo cargado; sí con `Escape`, la X o Cancelar.
- Esto no son route groups (no separa roles ni cambia la URL): la regla de "Roles y URLs" sigue igual.

## Llamadas a la API: `fetchJson` y `ApiError`

- `src/utils/fetch-json.ts` es el **único** lugar que interpreta la respuesta de error de la API (`{ error: { code, message, details? } }`) y la convierte en un `ApiError` con `status`, `code` y `details`.
- Cada `<entidad>.api.ts` llama a `fetchJson<T>(...)` en lugar de repetir el parseo. No hay `fetch` directo en componentes, hooks ni páginas, ni `fetch` a otros orígenes.
- Los hooks se tipan con el error: `useQuery<TData, ApiError>(...)` y `useMutation<TData, ApiError, TVariables>(...)`, para tener `error.status` y `error.code` sin cast.
- Las query keys salen solo de `<entidad>.keys.ts`. Una mutación invalida las keys de su entidad.
- Los tipos siguen el contrato: los listados son `PaginatedResponse<T>` (`{ data, meta }`) y el recurso individual viene directo.

## Manejo de errores en la UI

`proxy.ts` (que protege todas las páginas salvo `/login`) solo garantiza que hay una cookie; no que la sesión sea válida ni que el rol alcance. Por eso cada componente con datos maneja `isError` con su propia UI y no asume que, si la página cargó, el usuario tiene permiso.

| Caso                       | Qué hace la UI                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 `VALIDACION`           | En formularios, marca cada campo con su mensaje (`setError` a partir de `details`). Fuera de un formulario, muestra `message`                                                    |
| 401                        | Sesión vencida o inválida: redirige a `/login?motivo=sesion_expirada`, donde se muestra el aviso. Se centraliza en `providers.tsx` (`onError` de `QueryCache` y `MutationCache`) |
| 403 `SIN_PERMISO`          | Mensaje de "sin permiso" en el lugar del contenido; no redirige                                                                                                                  |
| 403 `USUARIO_INHABILITADO` | El usuario fue dado de baja con la sesión abierta: cierra la sesión y lleva a `/login` con "Su usuario no está habilitado". Se centraliza junto al 401 en `providers.tsx`        |
| 404                        | Estado de "no encontrado"                                                                                                                                                        |
| 409                        | Muestra `message`. Si el `code` es específico (por ejemplo `BLOQUE_LLENO`), usa `details` (por ejemplo, lista las fechas llenas)                                                 |
| 500 o error de red         | Mensaje genérico con opción de reintentar                                                                                                                                        |

Las dos redirecciones a `/login` (401 y 403 `USUARIO_INHABILITADO`) viajan con el motivo en la URL: los valores están en `features/auth/sesion-expirada.ts` y los lee `AvisoSesionExpirada` en `/login`. Es el único lugar que conoce esos nombres.

## Autenticación en el cliente

- `features/auth/auth-client.ts` crea el cliente con `createAuthClient` de `better-auth/react`.
- Login: `authClient.signIn.email(...)` desde `LoginForm` (en `/login`). Logout: `authClient.signOut()` desde `UserMenu`. Sesión y rol para la UI: `authClient.useSession()`.
- No se importa `@/lib/auth`: es la instancia del servidor y ESLint lo bloquea. Los campos extra de `Usuario` se redeclaran del lado del cliente con el plugin `inferAdditionalFields` (`role`, `apellido`, `dni`, `telefono` y `estado`), sin importar tipos del servidor; si cambian en `src/lib/auth.ts`, se cambian acá en el mismo PR. `busqueda` queda afuera: en el servidor tiene `returned: false` y nunca llega al cliente.
- El rol en el cliente solo sirve para mostrar u ocultar navegación y acciones. La seguridad es la API.
- **Errores del login.** `/api/auth` responde con el formato de Better Auth, no con el de `/api/v1`: el `authClient` lo expone como `error.code` / `error.message`, y el `message` viene en inglés. El texto que ve el usuario se elige **por `code`**, en el único lugar que decide eso: `features/auth/interpretar-error-login.ts` (`INVALID_EMAIL_OR_PASSWORD` → "Usuario o contraseña incorrectos"; `USUARIO_INHABILITADO` → "Su usuario no está habilitado"; tabla completa en `contrato-api.md` → Autenticación). Un login fallido muestra un mensaje solo, que nunca dice qué campo falló ni si el email existe; quién puede entrar lo decide la API.
- El login no manda `rememberMe`: la sesión vence siempre por inactividad (60 min, decisión T-24) y la API neutraliza ese valor igual.
- Al cerrar sesión se vacía la cache de TanStack Query, para que volver con Atrás no muestre datos del usuario anterior.
- No hay pantalla de registro ni de recuperación de contraseña: las cuentas se crean desde el servidor (el seed y, para los profesores, mesa de entradas; `dominio.md` → Roles).

## Formularios

- `react-hook-form` + `zodResolver`, con el schema de la feature (`<entidad>.schema.ts`, usando el `z` de `zod`).
- Los schemas del frontend no se comparten con el backend (T-08). Replican las reglas de **formato** del contrato (DNI de 7 u 8 dígitos aceptando puntos, email, teléfono, fechas `YYYY-MM-DD`, horas `HH:mm`) para dar feedback inmediato. La validación que manda es la de la API, y sus 400 se muestran en los campos.
- Nada de reglas de negocio en el frontend: DNI duplicado, solapamientos, capacidad, prioridad y vigencia los decide la API.
- **Única excepción, solo como ayuda visual (T-28): la edad del alumno.** `features/alumnos/edad.ts` replica la cuenta de "menor de edad" del backend para que el formulario, mientras se tipea la fecha, muestre el aviso y los asteriscos de los datos del tutor. **No bloquea el envío**: el schema del formulario no valida el tutor. La regla la valida la API (con su propio "hoy", hora de Salta) y sus 400 se muestran en los campos; la sección del tutor se muestra también si alguno de sus campos tiene un error, para que un 400 nunca quede sobre un campo oculto. El detalle usa el `menorDeEdad` que devuelve la API, no la función del cliente. Si la regla cambia en `src/server/features/alumnos/edad.ts`, se cambia acá en el mismo PR.

## Fechas y horas

- Una fecha de calendario es un string `YYYY-MM-DD` en todo el frontend: se recibe y se envía así.
- **Nunca `new Date('YYYY-MM-DD')`**: JavaScript lo interpreta como medianoche UTC, y en Argentina (UTC−3) se muestra el día anterior. Para mostrar o calcular, `parseISO` y `format` de `date-fns` (`parseISO` interpreta una fecha sin hora como hora local).
- Las horas son strings `HH:mm`; el frontend no las convierte a minutos (eso es del backend).
- Los instantes de auditoría (`createdAt`, `updatedAt`) llegan en ISO 8601 UTC y se formatean con `date-fns` para mostrarlos en hora local.
- Para proponer "hoy" en un selector (por ejemplo la agenda), se usa la fecha local del navegador con `format(new Date(), 'yyyy-MM-dd')`. Qué es "hoy" para las reglas lo decide la API.

## Estilos y UI

- Tailwind v4. Las clases condicionales se arman con `cn()` de `utils/cn.ts`.
- Aspecto general, según el Figma: el contenido de la app autenticada va sobre `canvas` (gris azulado claro) y cada bloque es una tarjeta blanca (`Card`, `Panel`) redondeada, con sombra suave y sin borde duro. Cada pantalla empieza con `components/layout/page-header.tsx` (título, descripción y la acción principal, con `Button size="lg"`).
- **Paleta de marca**, definida como tokens de color en `src/app/globals.css` (`@theme`), a partir del Figma:
  - Página: `cobalto` (marca y foco), `blanco`, `tinta` (texto), `piedra` (neutro cálido), `dorado` (acentos), `oscuro` (interfaz), `luminoso` (fondo claro).
  - Acciones: `confirmado`, `cancelado`, `urgente`, `pendiente`.
  - Semánticos (los usan los primitivos): `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, todos mapeados a la paleta de marca. Sin variante de modo oscuro: el Figma no define una.
  - De la app, fuera de la paleta de página: `sidebar` (fondo del Sidebar) y `canvas` (fondo del contenido y de las zonas "hundidas" dentro de una tarjeta: encabezado de tabla, avisos, observaciones). Inputs, tarjetas y modales quedan en `background` (blanco).
- `components/ui/`: primitivos con la API de shadcn/ui, escritos a mano (T-26, antes D-08: no se usa el CLI de shadcn porque su preset actual genera `src/lib/utils.ts`, zona backend, y un `cn` propio que reemplazaría a `utils/cn.ts`). Usan `class-variance-authority` para variantes y, donde hace falta accesibilidad de teclado/foco, un primitivo de `@radix-ui/react-*` (`Dialog`, `Select`, `Avatar`, `DropdownMenu`, `Label`, `Checkbox`, `Tabs`, `Tooltip`, y `Slot` para el `asChild` de `Button`).
  - Disponibles: `Button` (además de las de shadcn, variantes `confirmado` y `cancelado` para Guardar/Cancelar de los formularios; `size="lg"` es el alto de los inputs), `Input`, `Label`, `Textarea`, `Checkbox`, `Badge` (con variantes `confirmado`/`cancelado`/`urgente`/`pendiente` y `accent`, dorado, para avisos como "Menor de edad"), `Avatar`, `Card`, `Table`, `Select`, `Tabs`, `Tooltip`, `Dialog` (`showCloseButton={false}` para poner la X a mano), `DropdownMenu`, `Pagination` (y `PaginationControls`, el paginador numerado completo, con `utils/page-range.ts`), `Alert` (variantes `default`/`destructive`, para los estados de error de la tabla de arriba), `Skeleton` (estado de carga).
  - Propios (no son de shadcn), para que todas las features se vean igual:
    - `Panel` (`PanelHeader`, `PanelTitle`, `PanelDescription`, `PanelBody`, `PanelFooter`, `PanelClose`): encabezado + cuerpo con scroll + pie, que se muestra como modal (`mode="modal"`, sobre `Dialog`) o como tarjeta de página (`mode="page"`). Ver Modales con URL propia.
    - `Field`: label (con `*` si es obligatorio o "(opcional)"), control y mensaje de error, con `htmlFor` y `fieldErrorId()` para el `aria-describedby`.
    - `SearchInput`: input de búsqueda con lupa y botón para limpiar.
    - `EmptyState`: ícono en círculo, título, descripción y una acción (listados sin resultados o sin datos).
  - No es una lista cerrada: cada feature suma el primitivo que le falte, siguiendo el mismo patrón (`cva` + Radix si hace falta accesibilidad) y actualizando esta lista y, si suma un paquete, `dependencias.md` en el mismo PR.
- Íconos: `lucide-react`.

## Tests

El alcance de los tests de frontend es la decisión abierta D-09. Hasta decidirlo, los tests automatizados cubren el backend, el matcher de `proxy.ts` y las funciones puras del frontend (`pnpm test:run`), como `features/auth/interpretar-error-login.ts`, `features/alumnos/edad.ts` y las de `utils/` (`page-range.ts`, `initials.ts`). `vitest.config.mts` recoge solo `src/**/*.test.ts`: un test de componente (`.tsx`, con Testing Library y jsdom) necesita además cambiar ese `include` y agregar esas dependencias, que es justamente lo que decide D-09.
