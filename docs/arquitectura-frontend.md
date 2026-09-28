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

Cuando una pantalla de una feature tiene que mostrar un **componente** de otra (no solo sus datos), lo compone `app/`, que puede importar de cualquier feature, y la feature que lo muestra lo recibe por una prop de render. Ejemplo: el tab "Agenda" de la ficha del profesor. `ProfesorDetalle` recibe `renderAgenda: (profesor) => ReactNode`, y `app/mesa/profesores/[profesorId]/page.tsx` (y `editar/page.tsx`, que monta el detalle de fondo) le pasa `<AgendaProfesorListado profesorId={profesor.id} />` de `features/turnos`. No se mueve el componente a `components/ui/` para saltear la regla.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                      # layout raíz: solo <Providers> (sin Header ni Sidebar)
│   ├── providers.tsx                   # QueryClientProvider (TanStack Query) + ToastProvider
│   ├── page.tsx                        # "/": redirige al segmento del rol de la sesión
│   ├── login/page.tsx                  # pública; usa features/auth
│   ├── mesa/                           # rol MESA_ENTRADAS → /mesa/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<MesaSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /mesa/alumnos
│   │   ├── alumnos/
│   │   │   ├── layout.tsx              # {children} + {modal}
│   │   │   ├── page.tsx                # listado (q y page en la URL)
│   │   │   ├── nuevo/page.tsx          # alta entrando por URL: el listado de fondo
│   │   │   ├── [alumnoId]/
│   │   │   │   ├── layout.tsx          # {children} + {modal}: el slot de la edición
│   │   │   │   ├── page.tsx            # página de detalle (una sola sección hoy; ver "Modales con URL propia" → tabs)
│   │   │   │   ├── editar/page.tsx     # edición entrando por URL: el detalle de fondo
│   │   │   │   └── @modal/             # edición, siempre como modal sobre el detalle
│   │   │   │       ├── default.tsx, page.tsx   # null (igual que en el slot del listado)
│   │   │   │       ├── (.)editar/page.tsx      # navegando desde el detalle (intercepción)
│   │   │   │       └── editar/page.tsx         # entrando por URL o al recargar
│   │   │   └── @modal/                 # alta, siempre como modal sobre el listado
│   │   │       ├── default.tsx         # null: sin modal al cargar por URL una ruta que el slot no define
│   │   │       ├── page.tsx            # null: cierra el modal al volver al listado con un Link
│   │   │       ├── (.)nuevo/page.tsx   # navegando desde el listado (intercepción)
│   │   │       ├── nuevo/page.tsx      # entrando por URL o al recargar
│   │   │       └── [alumnoId]/page.tsx # null: sin modal del listado al ir al detalle
│   │   ├── profesores/page.tsx
│   │   ├── materias/page.tsx
│   │   ├── turnos/page.tsx
│   │   └── agenda/page.tsx              # "Agenda diaria" (HU-09, T-24)
│   ├── profesor/                       # rol PROFESOR → /profesor/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<ProfesorSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /profesor/agenda
│   │   ├── agenda/page.tsx             # "Mi agenda" (HU-10, T-26): ?vista=dia|semana y ?fecha=
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
│   ├── aulas/                          # mínima, solo de lectura: aulas libres para un horario
│   │   ├── aulas.types.ts, api/{aulas.api.ts, aulas.keys.ts}
│   │   └── hooks/{use-aulas-disponibles.ts, use-invalidar-aulas.ts}   # lo único que usan otras features
│   ├── profesores/                     # incluye la sección "Horario" (bloques): horario.ts, errores-bloques.ts,
│   │                                   # turnos-vigentes.ts y TurnosQueImpidenLaBaja (una muestra de los turnos que impiden la baja),
│   │                                   # HorarioProfesor, BloquePanel, BloqueForm, BloqueDetalleModal, ConfirmarBajaBloque
│   ├── turnos/                         # registrar turno (HU-07), agenda diaria (HU-09, T-24), agenda propia (HU-10, T-26) y agenda de la ficha del profesor (HU-02)
│   │   ├── turnos.types.ts, turnos.schema.ts
│   │   ├── errores-turnos.ts, formato-turnos.ts, seleccion-turno.ts, agenda-propia.ts
│   │   ├── api/{turnos.api.ts, turnos.keys.ts}
│   │   ├── hooks/{use-disponibilidad.ts, use-invalidar-disponibilidad.ts, use-crear-turnos.ts, use-turno.ts,
│   │   │   use-agenda.ts, use-agenda-propia.ts, use-agenda-profesor.ts, use-rango-agenda-en-url.ts}
│   │   └── components/
│   │       ├── RegistrarTurnoPantalla.tsx, RegistrarTurno.tsx: una pantalla por secciones (SeccionPaso.tsx,
│   │       │   SeleccionAlumno.tsx, FiltrosDisponibilidad.tsx, ResultadosDisponibilidad.tsx, HorasDelBloque.tsx,
│   │       │   TurnoForm.tsx, RechazoAlta.tsx, ConfirmacionTurno.tsx)
│   │       ├── TurnoDetalleModal.tsx    # detalle de solo lectura (?detalle=<id>)
│   │       ├── AgendaDiariaPantalla.tsx, AgendaDiariaListado.tsx, AgendaTable.tsx, NavegacionFecha.tsx,
│   │       │   FiltroProfesorAgenda.tsx # agenda diaria (HU-09, T-24); NavegacionFecha la comparten las dos agendas
│   │       ├── AgendaPorRango.tsx, AgendaPropiaTable.tsx, SelectorVistaAgenda.tsx # vista por día o por
│   │       │   semana (controlada) que comparten las dos agendas por rango
│   │       ├── AgendaPropiaPantalla.tsx, AgendaPropiaListado.tsx # agenda propia del profesor (HU-10, T-26)
│   │       └── AgendaProfesorListado.tsx # tab "Agenda" de la ficha del profesor (HU-02); lo compone app/
│   └── alumnos/                        # modelo de nombres y firmas para las demás entidades
│       ├── alumnos.types.ts
│       ├── alumnos.schema.ts            # schema Zod del formulario + funciones de conversión form↔API
│       ├── volver-a.ts                  # ida y vuelta al alta desde otra pantalla (?volverA=, lista blanca)
│       ├── edad.ts                      # "menor de edad" en el formulario: solo ayuda visual (ver Formularios)
│       ├── errores-api.ts               # helper: mapea ApiError a errores del formulario
│       ├── api/{alumnos.api.ts, alumnos.keys.ts}
│       ├── hooks/{use-alumnos.ts, use-alumno.ts, use-crear-alumno.ts, use-editar-alumno.ts, use-buscador-alumnos.ts}
│       └── components/
│           ├── AlumnosPantalla.tsx      # encabezado + listado: la página del listado y el fondo del alta
│           ├── AlumnosListado.tsx, AlumnosTable.tsx, BuscadorAlumnos.tsx, SinResultados.tsx, TotalAlumnos.tsx
│           ├── AlumnoDetalle.tsx        # página de detalle (tab "Turnos" oculta hasta implementarla; ver "Modales con URL propia")
│           ├── AlumnoNuevo.tsx, AlumnoEditar.tsx   # alta y edición en un <Panel> (modal)
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
├── hooks/{use-debounce.ts, use-toast.ts}   # use-toast: contexto y hook de los toasts
├── types/index.ts                      # PaginatedResponse<T>, Role, Auditoria y UsuarioAuditoria (contrato)
└── utils/{cn.ts, fetch-json.ts, page-range.ts, initials.ts, caracteres.ts, dias-semana.ts, horas.ts, calendario.ts, auditoria.ts}
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
| `components/`                              | Componentes de la entidad (`<Entidad>Table.tsx`, `<Singular>Form.tsx`…). La página de detalle es `<Singular>Detalle.tsx` (pide sus datos y arma sus tabs). El alta y la edición son `<Singular>Nuevo.tsx` y `<Singular>Editar.tsx`: se arman con `Panel` y reciben `mode` y los callbacks de navegación (`onCerrar`, `onCreado`, `onGuardado`) desde la página del slot (ver Modales con URL propia)                                                                |

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

El **detalle de una entidad sencilla** (una hora del horario, y a futuro materias y otras con pocos datos y sin secciones propias) no es una página: es un **modal de solo lectura** con `DetalleModal` de `components/ui/` (decisión T-34). La feature solo arma sus datos con `Datos` / `Dato` y le pasa la query (`cargando`, `error`, `onReintentar`) y la auditoría: el modal resuelve la carga, el 404, el 403, la sección "Trazabilidad" y el pie con "Cerrar" y las acciones (por ejemplo, un link a la edición). Se abre con un parámetro de la pantalla que queda de fondo, con el mismo criterio que `?editar=<id>` (en el horario del profesor, `?tab=horario&detalle=<id>`), y se cierra también con un clic afuera: no hay nada que perder.

El **detalle** de una entidad con secciones propias es una **página** (`[id]/page.tsx`), con tabs cuando tiene más de una sección: `alumnos` hoy solo muestra "Datos del alumno", sin `Tabs` (una sola pestaña no se envuelve en tabs). Existió ahí una segunda pestaña "Turnos", oculta a propósito hasta que haya un endpoint que devuelva los turnos de un alumno (comentario en `AlumnoDetalle.tsx` con el JSX que se sacó): cuando se implemente, se vuelve a envolver `DatosAlumno` en `Tabs`. El **alta** y la **edición** se abren **siempre como modal**, encima de la pantalla desde la que se abrieron: el alta y la edición desde el lápiz de una fila, encima del listado; la edición desde "Editar" del detalle, encima de la página de detalle. Entrando por URL o al recargar, cada modal queda sobre la misma pantalla. Todas tienen URL propia (`/mesa/alumnos/nuevo`, `/mesa/alumnos/12/editar`, `/mesa/alumnos?editar=12`), así que se pueden compartir y Atrás cierra el modal. El alta y la edición desde el detalle usan el patrón de Next de Parallel + Intercepting Routes (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md` → Modals); `alumnos` es el modelo:

- Hay dos slots `@modal`, cada uno en el layout de la pantalla que queda de fondo: `app/<segmento>/<entidad>/layout.tsx` (alta, sobre el listado) y `app/<segmento>/<entidad>/[id]/layout.tsx` (edición, sobre el detalle). Los dos renderizan `{children}` y `{modal}` (tipado con `LayoutProps`, que ya trae `modal`).
- **Navegando:** `@modal/(.)nuevo/page.tsx` (desde el listado) y `[id]/@modal/(.)editar/page.tsx` (desde el detalle) interceptan la navegación y muestran el componente de la feature con `mode="modal"`. `children` sigue siendo la pantalla de fondo, con su estado (el `q` y la `page` del listado, el tab del detalle).
- **Nunca una carpeta interceptora con parámetro dinámico** (`@modal/(.)[id]/…`). En Next 16, con `pnpm dev`, cada recompilación le vuelve a agregar el `(.)` al parámetro (`Invalid interception route: /mesa/alumnos/(.)(.)(.)2/editar`, o `alumnoId` llega como `"(.)2"`). La navegación del cliente falla con un 500 y el navegador recarga la página entera, sin intercepción. Recién reiniciado funciona, así que el error aparece y desaparece.
- **Edición desde el lápiz del listado:** por eso no es una ruta interceptada, sino un parámetro del listado, `?editar=<id>` (se suma a `q` y `page`). `<Entidad>Listado` lo lee y muestra `<Singular>Editar` con `mode="modal"`. El lápiz lo agrega con un `Link` (`push`, así Atrás cierra el modal); cerrar o guardar es `router.back()` si se abrió con el lápiz en esa pestaña, o `router.replace` sin `editar` si se entró por URL.
- Después de crear, mover o borrar carpetas de rutas, **reiniciar `pnpm dev`**: con el árbol de rutas viejo en memoria, las rutas nuevas o borradas se comportan mal.
- **Entrando por URL o al recargar:** no hay intercepción. `nuevo/page.tsx` renderiza el listado de fondo (`<Entidad>Pantalla`, el mismo componente que usa `page.tsx`) y `[id]/editar/page.tsx` el detalle; el modal lo ponen `@modal/nuevo/page.tsx` y `[id]/@modal/editar/page.tsx`, las rutas de cada slot sin `(.)`.
- Rutas del slot que devuelven `null`: `default.tsx`, para la carga por URL de una ruta que el slot no define; `page.tsx`, para que volver a la pantalla de fondo (un `Link` al listado, como el del Sidebar, o `router.replace` al detalle) cierre el modal; y `@modal/[id]/page.tsx` en el slot del listado, para que ir al detalle no deje un modal del listado abierto. Sin ellas, en una navegación del cliente el slot conserva el último modal abierto.
- `AlumnoNuevo` y `AlumnoEditar` se arman con `Panel` de `components/ui/` y **no navegan solos**. Quien los monta les pasa qué hacer al cerrar o al guardar:
  - **Interceptada:** cerrar es `router.back()` (vuelve al listado con su `q` y su `page`, o al detalle); guardar también, tanto el alta como la edición. Tras un alta se vuelve al listado, que ya se invalidó y muestra al alumno nuevo.
  - **Por URL:** puede no haber historial dentro de la app. Cerrar el alta va al listado con `router.push` y crear, con `router.replace` (Atrás no reabre el formulario). Cerrar o guardar la edición vuelve al detalle con `router.replace`.
- **Tab del detalle y formularios de una sección:** el tab activo del detalle va en la URL (`?tab=materias`, `?tab=horario`, `?tab=agenda`; sin `tab`, el primero), con `router.replace` para que cambiar de tab no sume entradas al historial. Así, un formulario que vive dentro de un tab se abre con un parámetro más, con el mismo criterio que `?editar=<id>` (sin interceptor con parámetro dinámico): el horario del profesor usa `?tab=horario&bloque=nuevo` (alta) y `?tab=horario&bloque=<id>` (edición de esa hora), y `HorarioProfesor` monta el `Panel` modal. Se abre con un `Link` (`push`: Atrás lo cierra); cerrar o guardar es `router.back()` si se abrió desde la sección en esa pestaña, o `router.replace` a `?tab=horario` si se entró por URL. La URL sigue la misma ayuda visual que los botones: si la sección no ofrece ese formulario (profesor inactivo, o alta sin materias asignadas), no lo monta y, una vez que lo sabe, saca el parámetro con `router.replace`. Convive con el slot `@modal` de la edición del profesor, que es otra ruta (`[id]/editar`). El detalle lee la URL con `useSearchParams`, así que su página lo monta dentro de `<Suspense>`. Las confirmaciones (por ejemplo, eliminar un bloque) son un `Dialog` sin URL propia.
- **Agendas por rango (vista por día o por semana):** "Mi agenda" (`/profesor/agenda`) y el tab "Agenda" de la ficha del profesor comparten `AgendaPorRango` (navegación, selector, tabla, error y pie; controlado, no conoce el endpoint) y el hook `useRangoAgendaEnUrl({ vistaPorDefecto })`, que guarda `vista` y `fecha` en la URL con `router.replace` sobre la ruta actual y conserva los demás parámetros (el `tab`). Los parámetros los arma `paramsDeRango` (`agenda-propia.ts`, con tests): omite la vista por defecto y el rango de hoy, y en la vista semanal guarda el lunes. "Mi agenda" es por día por defecto (`?vista=semana&fecha=…`); la ficha, por semana (`?tab=agenda&vista=dia&fecha=…`). Cada contenedor elige su hook de datos (`useAgendaPropia` o `useAgendaProfesor`) y su texto para el 404. Cambiar de tab descarta `vista` y `fecha`: al volver, se ve la semana actual.
- `Panel` conserva `mode="page"` (tarjeta dentro de la página) para pantallas que no sean modales.
- El modal de un formulario no se cierra con un clic afuera (`dismissOnInteractOutside={false}`), para no perder lo cargado; sí con `Escape`, la X o Cancelar.
- Esto no son route groups (no separa roles ni cambia la URL): la regla de "Roles y URLs" sigue igual.

### Ida y vuelta al alta desde otra pantalla (`volverA`)

Una pantalla que necesita un alta de otra entidad y volver con lo creado (registrar turno → alta de alumno) abre el alta con `?volverA=<destino>`. Al crear, el alta va al destino con el id (`/mesa/turnos?alumnoId=<id>`); al cancelar, al destino solo. Sin `volverA`, el alta se comporta como siempre.

- `volverA` es un **nombre de una lista blanca**, nunca una URL (así el query no puede mandar a cualquier lado: open redirect). La lista y las rutas de vuelta viven en un solo lugar, `features/alumnos/volver-a.ts` (`parsearVolverA`, `rutasDeVuelta`, `hrefAltaConVuelta`); un valor que no está en la lista se ignora.
- Las dos rutas del alta (la interceptada `@modal/(.)nuevo` y la de URL `@modal/nuevo`) leen `volverA` con `useSearchParams`, dentro de `<Suspense>`. Las rutas de la lista son relativas al segmento del rol: la página pasa el segmento (`/mesa`).
- La pantalla de destino lee el id (`?alumnoId=`) con el hook de detalle de la otra feature (`useAlumno`) y lo deja elegido; si da 404, avisa y deja el buscador. Al terminar ("Registrar otro turno"), saca el id de la URL con `router.replace`.
- **Para sumar un destino:** agregarlo a `DESTINOS` de `volver-a.ts` con sus dos rutas (al crear y al cerrar), y armar el link con `hrefAltaConVuelta` desde la página del destino. Otra entidad con alta (profesores, materias) que necesite lo mismo tiene su propio `volver-a.ts` con el mismo patrón.

## Llamadas a la API: `fetchJson` y `ApiError`

- `src/utils/fetch-json.ts` es el **único** lugar que interpreta la respuesta de error de la API (`{ error: { code, message, details? } }`) y la convierte en un `ApiError` con `status`, `code` y `details`.
- Cada `<entidad>.api.ts` llama a `fetchJson<T>(...)` en lugar de repetir el parseo. No hay `fetch` directo en componentes, hooks ni páginas, ni `fetch` a otros orígenes.
- Los hooks se tipan con el error: `useQuery<TData, ApiError>(...)` y `useMutation<TData, ApiError, TVariables>(...)`, para tener `error.status` y `error.code` sin cast.
- Las query keys salen solo de `<entidad>.keys.ts`. Una mutación invalida las keys de su entidad. Si además cambia datos que cachea otra feature, la invalida con un hook que esa feature expone (por ejemplo `useInvalidarAulas` de `features/aulas/hooks/`, que usan las mutaciones de bloques, o `useInvalidarMaterias`, que tienen que usar las de asignar y quitar materias a un profesor: el detalle de la materia lista sus profesores; o `useInvalidarHorarioDe` de `features/profesores/hooks/use-invalidar-horario.ts`, que recibe el profesor al invocarla y usa el alta de turnos porque el horario muestra la ocupación, T-33; las mutaciones de bloques usan `useInvalidarHorario(profesorId)`, que es la misma con el profesor fijo), no importando sus keys: de otra feature solo se usan sus hooks.
- Una feature mínima que solo expone un selector a otras (`aulas`) tiene `types`, `api/`, `keys` y el hook; no necesita tabla ni formulario (no se crea con `/nueva-feature-ui`). Una feature completa también puede exponer el suyo: `materias` tiene su pantalla y además `useMateriasSelector`, que consume el filtro por materia de profesores. Si el selector depende de lo elegido en el formulario (aulas libres para un día y horario), los parámetros van en la key y la query queda deshabilitada (`enabled`) hasta que estén completos. Si el hook conserva la lista anterior mientras llega la nueva (`keepPreviousData`), el formulario arma las opciones solo con los datos del horario actual (descarta los de `isPlaceholderData`): mientras tanto el selector queda deshabilitado y Guardar también, porque lo elegido puede ya no estar disponible.
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

## Notificaciones (toasts)

Avisos efímeros abajo a la derecha, sin librería externa. Se muestran con `useToast()` desde cualquier componente de `features/` o `components/`:

```tsx
const toast = useToast()
mutation.mutate(datos, {
  onSuccess: (alumno) => {
    toast.success(`Se registró a ${alumno.nombre} ${alumno.apellido}`)
    onCreado(alumno)
  },
})
```

- **Piezas.** `hooks/use-toast.ts`: tipos, contexto y `useToast()` (sin componentes, así cualquiera lo importa sin romper Fast Refresh). `components/ui/toast.tsx`: `ToastProvider` (estado, ids, autocierre y la pila en pantalla) y la UI de cada toast. `app/providers.tsx` lo monta una sola vez para toda la app, y sobrevive a la navegación (por ejemplo, al `router.back()` que cierra un modal).
- **API.** `toast.success | error | warning | info(mensaje, { duracion? })` devuelve el id; `toast.cerrar(id)` lo cierra antes. Por defecto dura 4 s (`success`), 5 s (`info`), 6 s (`warning`) y 8 s (`error`); `duracion: Infinity` lo deja hasta que se cierre con la X. Hay como máximo 5 en pantalla: los más viejos se descartan. El objeto `toast` es estable entre renders: se puede poner en las dependencias de un `useEffect`.
- **Colores:** `confirmado` (éxito), `cancelado` (error), `urgente` (advertencia) y `cobalto` (información).
- **Quién lo dispara.** El componente de la feature que ejecuta la mutación, en el `onSuccess`/`onError` del `mutate` (como `AlumnoNuevo` y `AlumnoEditar`). Los hooks `use-crear-*` / `use-editar-*` **no** muestran toasts: solo invalidan la cache, para que cada pantalla decida qué avisar.
- **Solo texto.** El toast no conoce la API: convertir un `ApiError` en un mensaje legible le toca a quien lo llama.
- **Cuándo no usarlo.** Los errores de un formulario (400 por campo, 409, error general) se muestran en el formulario, no en un toast: el usuario los corrige ahí. Tampoco reemplaza el estado de error, 403 o 404 de una pantalla con datos (ver Manejo de errores en la UI). El toast confirma una acción que terminó bien, o avisa el error de una acción que no tiene un lugar propio donde mostrarlo (por ejemplo, un botón en una fila).
- **Accesibilidad.** El contenedor es `aria-live="polite"` y está siempre montado (un `aria-live` que aparece junto con su contenido no se anuncia). El autocierre se pausa con el mouse encima o con el foco adentro. Respeta `prefers-reduced-motion`.
- **Con un modal abierto.** El contenedor está en `z-60`, por encima de `Dialog` y `Panel` (`z-50`), y `DialogContent` ignora los clics sobre un toast: cerrarlo no cierra el modal.
- Las animaciones (`animate-toast-in`, `animate-toast-out`) están en `globals.css`; la duración de `toast-out` tiene que coincidir con `DURACION_SALIDA` de `toast.tsx`.

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
- **Caracteres permitidos (nombres, DNI, teléfono).** Se validan en tres capas, cada una con su función:
  1. **API** (la que manda): `nombrePersona`, `dni` y `telefono` de `src/server/shared/zod.ts` rechazan con 400 `VALIDACION` sobre el campo. Ningún cliente (otro front, Postman, un script) puede saltearla.
  2. **Schema del formulario**: replica el formato con `utils/caracteres.ts` (`tieneSoloCaracteres`, `tieneAlgunaLetra`) y muestra el error en el campo antes de enviar, también si el valor llegó por autocompletado o por una composición (IME).
  3. **Input**: `<Input caracteres="nombre" | "dni" | "telefono">` descarta lo que el tipo no acepta mientras se escribe o se pega, sin mover el cursor al final. Es comodidad: no reemplaza a las otras dos. Se combina con `inputMode="numeric"` (DNI y teléfono) para el teclado del celular. No se usa `maxLength` en el DNI: cortaría un DNI pegado con puntos antes de filtrarlo.
  - Los caracteres de cada tipo están en `utils/caracteres.ts` (un solo lugar para el schema y el input). Si cambian en `shared/zod.ts`, se cambian ahí en el mismo PR. Un tipo nuevo (por ejemplo, matrícula) se agrega a los dos.
- Nada de reglas de negocio en el frontend: DNI duplicado, solapamientos, capacidad, prioridad y vigencia los decide la API.
- **Única excepción, solo como ayuda visual (T-28): la edad del alumno.** `features/alumnos/edad.ts` replica la cuenta de "menor de edad" del backend para que el formulario, mientras se tipea la fecha, muestre el aviso y los asteriscos de los datos del tutor. **No bloquea el envío**: el schema del formulario no valida el tutor. La regla la valida la API (con su propio "hoy", hora de Salta) y sus 400 se muestran en los campos; la sección del tutor se muestra también si alguno de sus campos tiene un error, para que un 400 nunca quede sobre un campo oculto. El detalle usa el `menorDeEdad` que devuelve la API, no la función del cliente. Si la regla cambia en `src/server/features/alumnos/edad.ts`, se cambia acá en el mismo PR.

## Fechas y horas

- Una fecha de calendario es un string `YYYY-MM-DD` en todo el frontend: se recibe y se envía así.
- **Nunca `new Date('YYYY-MM-DD')`**: JavaScript lo interpreta como medianoche UTC, y en Argentina (UTC−3) se muestra el día anterior. Para mostrar o calcular, `parseISO` y `format` de `date-fns` (`parseISO` interpreta una fecha sin hora como hora local).
- Las horas son strings `HH:mm`; el frontend no las convierte a minutos (eso es del backend).
- El día de la semana es el entero ISO de la API (1 = lunes … 7 = domingo); su nombre sale de `utils/dias-semana.ts` (`DIAS_SEMANA`, `nombreDiaSemana`).
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
  - Disponibles: `Button` (además de las de shadcn, variantes `confirmado` y `cancelado` para Guardar/Cancelar de los formularios y `accent`, dorada, para la acción de editar; `size="lg"` es el alto de los inputs), `Input` (con `caracteres` para descartar lo que un nombre, DNI o teléfono no acepta; ver Formularios), `Label`, `Textarea`, `Checkbox`, `Badge` (con variantes `confirmado`/`cancelado`/`urgente`/`pendiente` y `accent`, dorado, para avisos como "Menor de edad"), `Avatar`, `Card`, `Table`, `Select`, `Tabs`, `Tooltip`, `Dialog` (`showCloseButton={false}` para poner la X a mano; con un alto máximo, para que un contenido largo no deje los botones del pie fuera de la pantalla), `DropdownMenu`, `Pagination` (y `PaginationControls`, el paginador numerado completo, con `utils/page-range.ts`), `Alert` (variantes `default`/`destructive`, para los estados de error de la tabla de arriba), `Skeleton` (estado de carga).
  - Propios (no son de shadcn), para que todas las features se vean igual:
    - `Panel` (`PanelHeader`, `PanelTitle`, `PanelDescription`, `PanelBody`, `PanelFooter`, `PanelClose`): encabezado + cuerpo con scroll + pie, que se muestra como modal (`mode="modal"`, sobre `Dialog`) o como tarjeta de página (`mode="page"`). Ver Modales con URL propia.
    - `Field`: label (con `*` si es obligatorio o "(opcional)"), control y mensaje de error, con `htmlFor` y `fieldErrorId()` para el `aria-describedby`.
    - `SearchInput`: input de búsqueda con lupa y botón para limpiar.
    - `EmptyState`: ícono en círculo, título, descripción y una acción (listados sin resultados o sin datos).
    - `Datos` / `Dato` (`datos.tsx`): lista de datos de solo lectura (`<dl>`) en dos columnas; un dato sin valor muestra `—`. La usan todos los detalles, página o modal.
    - `Trazabilidad`: quién creó el registro y quién lo modificó por última vez, con fecha y hora local (`utils/auditoria.ts`). Recibe los cuatro campos de auditoría del contrato (tipo `Auditoria` de `types/index.ts`); cualquier detalle (`AlumnoDetalle`, `ProfesorDetalle`…) se le pasa entero.
    - `DetalleModal`: el detalle de solo lectura de una entidad sencilla (ver Modales con URL propia): encabezado, datos, trazabilidad, pie con "Cerrar" y acciones, y los estados de carga, 404, 403 y error con reintentar.
    - `CalendarioFecha` (`calendario-fecha.tsx`): selector de fecha con una grilla mensual que solo deja elegir los días de una restricción (`min` y/o un `diaSemana` ISO), con teclado (flechas, Enter, Escape) y un botón opcional para vaciar el campo (`textoVaciar`). Entrega `YYYY-MM-DD`. Se usa en lugar de `<input type="date">` cuando la fecha tiene que caer en un día de la semana (el turno, en el día de su bloque): el input nativo deja escribir cualquier día, aun con `min` y `step`. La grilla sale de `utils/calendario.ts`. Es una ayuda para elegir: la API valida igual.
    - `ToastProvider` (`toast.tsx`): la pila de notificaciones. Se usa con `useToast()` de `hooks/use-toast.ts` (ver Notificaciones (toasts)).
  - No es una lista cerrada: cada feature suma el primitivo que le falte, siguiendo el mismo patrón (`cva` + Radix si hace falta accesibilidad) y actualizando esta lista y, si suma un paquete, `dependencias.md` en el mismo PR.
- Íconos: `lucide-react`.

## Tests

El alcance de los tests de frontend es la decisión abierta D-09. Hasta decidirlo, los tests automatizados cubren el backend, el matcher de `proxy.ts` y las funciones puras del frontend (`pnpm test:run`), como `features/auth/interpretar-error-login.ts`, `features/alumnos/edad.ts`, las del horario del profesor (`features/profesores/horario.ts`: agrupar las horas en bloques y las opciones de hora; `errores-bloques.ts`: los errores de la API de bloques en texto para la UI; `turnos-vigentes.ts`: el resumen y el texto de vigencia de los turnos que impiden la baja; y las conversiones del formulario de bloques de `profesores.schema.ts`) las de turnos (`features/turnos/turnos.schema.ts`: el body del alta; `errores-turnos.ts`: los errores del alta en lo que muestra la pantalla; `formato-turnos.ts`: fechas y rangos; `seleccion-turno.ts`: el bloque elegido y el agrupado del alta; `agenda-propia.ts`: el rango de la vista por día o por semana y el agrupado por fecha; `alumnos/volver-a.ts`: la lista blanca de `volverA`) y las de `utils/` (`page-range.ts`, `initials.ts`, `caracteres.ts`, `dias-semana.ts`, `horas.ts`, `auditoria.ts`). `vitest.config.mts` recoge solo `src/**/*.test.ts`: un test de componente (`.tsx`, con Testing Library y jsdom) necesita además cambiar ese `include` y agregar esas dependencias, que es justamente lo que decide D-09.
El alcance de los tests de frontend es la decisión abierta D-09. Hasta decidirlo, los tests automatizados cubren el backend, el matcher de `proxy.ts` y las funciones puras del frontend (`pnpm test:run`), como `features/auth/interpretar-error-login.ts`, `features/alumnos/edad.ts`, las del horario del profesor (`features/profesores/horario.ts`: agrupar las horas en bloques y las opciones de hora; `errores-bloques.ts`: los errores de la API de bloques en texto para la UI; y las conversiones del formulario de bloques de `profesores.schema.ts`) las de turnos (`features/turnos/turnos.schema.ts`: el body del alta; `errores-turnos.ts`: los errores del alta en lo que muestra la pantalla; `formato-turnos.ts`: fechas y rangos; `seleccion-turno.ts`: el bloque elegido y el agrupado del alta; `agenda-propia.ts`: el rango de la vista por día o por semana, el agrupado por fecha y los parámetros de la URL de las agendas por rango; `alumnos/volver-a.ts`: la lista blanca de `volverA`) y las de `utils/` (`page-range.ts`, `initials.ts`, `caracteres.ts`, `dias-semana.ts`, `horas.ts`, `calendario.ts`, `auditoria.ts`). `vitest.config.mts` recoge solo `src/**/*.test.ts`: un test de componente (`.tsx`, con Testing Library y jsdom) necesita además cambiar ese `include` y agregar esas dependencias, que es justamente lo que decide D-09.
