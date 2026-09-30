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

Cuando una pantalla de una feature tiene que mostrar un **componente** de otra (no solo sus datos), lo compone `app/`, que puede importar de cualquier feature, y la feature que lo muestra lo recibe por una prop de render. Ejemplo: el tab "Agenda" de la ficha del profesor. `ProfesorDetalle` recibe `renderAgenda: (profesor) => ReactNode`, y `app/mesa/profesores/[profesorId]/page.tsx` (y `editar/page.tsx`, que monta el detalle de fondo) le pasa `<AgendaProfesorListado profesorId={profesor.id} renderDetalle={…} />` de `features/agendas`. No se mueve el componente a `components/ui/` para saltear la regla.

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
│   │   ├── materias/page.tsx           # solo lectura (HU-12): listado y detalle, sin alta ni slot @modal
│   │   ├── turnos/page.tsx              # registrar turno; compone el detalle del turno (renderDetalle)
│   │   ├── agenda/page.tsx              # "Agenda diaria" (HU-09, T-24); compone el detalle y el PDF
│   │   ├── pagos/page.tsx               # vista global de pagos y deuda (HU-16); compone RegistrarPagoDialog
│   │   └── _componentes/                # composición de mesa: detalle-turno.tsx (el detalle con sus acciones) y
│   │                                    # ficha-alumno.tsx (las 4 pestañas de la ficha). Ver "Acciones sobre una ocurrencia"
│   ├── profesor/                       # rol PROFESOR → /profesor/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<ProfesorSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /profesor/agenda
│   │   ├── agenda/page.tsx             # "Mi agenda" (HU-10, T-26): ?vista=dia|semana y ?fecha=
│   │   ├── alumnos/page.tsx
│   │   └── _componentes/               # detalle-turno.tsx (sin acciones) y ficha-alumno.tsx (Datos y Exámenes)
│   ├── gerente/                        # rol GERENTE → /gerente/...
│   │   ├── layout.tsx                  # <AppShell sidebar={<GerenteSidebar />} userMenu={<UserMenu />}>
│   │   ├── page.tsx                    # raíz del segmento: lleva a /gerente/tablero
│   │   ├── tablero/page.tsx            # placeholder (T-62)
│   │   └── materias/                   # catálogo con escritura (HU-12): `puedeEscribir` (ver Roles y URLs)
│   │       ├── layout.tsx              # {children} + {modal}
│   │       ├── page.tsx                # listado; detalle (?detalle=) y edición (?editar=) como modales
│   │       ├── nueva/page.tsx          # alta entrando por URL: el listado de fondo
│   │       └── @modal/                 # default.tsx, page.tsx, (.)nueva/page.tsx, nueva/page.tsx
│   ├── portal/                         # se crea con las HU del alumno (Sprint 3)
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
│   ├── turnos/                         # registrar turno (HU-07) y reprogramar (placeholder AccionReprogramarTurno, T-50)
│   │   ├── turnos.types.ts, turnos.schema.ts
│   │   ├── errores-turnos.ts, formato-turnos.ts, seleccion-turno.ts
│   │   ├── api/{turnos.api.ts, turnos.keys.ts}
│   │   ├── hooks/{use-disponibilidad.ts, use-invalidar-disponibilidad.ts, use-crear-turnos.ts}
│   │   └── components/
│   │       ├── RegistrarTurnoPantalla.tsx, RegistrarTurno.tsx: una pantalla por secciones (SeccionPaso.tsx,
│   │       │   SeleccionAlumno.tsx, FiltrosDisponibilidad.tsx, ResultadosDisponibilidad.tsx, HorasDelBloque.tsx,
│   │       │   TurnoForm.tsx, RechazoAlta.tsx, ConfirmacionTurno.tsx); la confirmación abre el detalle del turno
│   │       │   (`?detalle=&fecha=`) que le llega por `renderDetalle`
│   │       └── AccionReprogramarTurno.tsx # slot del pie del detalle (placeholder, T-50)
│   ├── agendas/                        # las tres agendas: diaria (HU-09), propia (HU-10) y de la ficha del profesor (HU-02)
│   │   ├── agendas.types.ts, agenda-propia.ts (rango, agrupado y params de la URL), filtros-agenda.ts, modo-agenda.ts
│   │   ├── api/{agendas.api.ts, agendas.keys.ts}                # /api/v1/agendas/{diaria,propia,profesor}
│   │   ├── hooks/{use-agenda.ts, use-agenda-propia.ts, use-agenda-profesor.ts, use-rango-agenda-en-url.ts,
│   │   │   use-filtros-agenda.ts, use-modo-agenda.ts, use-invalidar-agendas.ts}
│   │   └── components/
│   │       ├── AgendaConModo.tsx        # lo común a las tres: selector Calendario/Lista, detalle en la URL, slot de acciones
│   │       ├── SelectorModoAgenda.tsx, CalendarioSemanal.tsx # el calendario es un placeholder (T-59)
│   │       ├── AgendaDiariaPantalla.tsx, AgendaDiariaListado.tsx, AgendaTable.tsx, NavegacionFecha.tsx,
│   │       │   FiltroProfesorAgenda.tsx # agenda diaria; NavegacionFecha la comparten las dos agendas por rango
│   │       ├── AgendaPorRango.tsx, AgendaPropiaTable.tsx, SelectorVistaAgenda.tsx # vista por día o por semana
│   │       ├── AgendaPropiaPantalla.tsx, AgendaPropiaListado.tsx # "Mi agenda"
│   │       └── AgendaProfesorListado.tsx # tab "Agenda" de la ficha del profesor; lo compone app/
│   ├── ocurrencias/                    # el detalle de un turno en una fecha y los turnos de un alumno (T-44)
│   │   ├── detalle-url.ts, api/ocurrencias.keys.ts, hooks/{use-detalle-en-url.ts, use-invalidar-ocurrencias.ts}
│   │   └── components/{OcurrenciaDetalle.tsx, TurnosDelAlumno.tsx}   # placeholders (T-44)
│   ├── cancelaciones/                  # HU-13 (T-46): cancelar uno o varios turnos
│   │   ├── cancelaciones.{types,schema}.ts, errores-api.ts, formato-cancelaciones.ts, api/{cancelaciones.api,cancelaciones.keys}.ts
│   │   ├── hooks/{use-cancelar-turnos.ts, use-invalidar-cancelaciones.ts}  # al cancelar invalida ocurrencias, agendas y cuentas
│   │   └── components/{AccionCancelarTurno, AccionCancelarVarios, CancelarTurnosDialog}.tsx
│   ├── finalizaciones/                 # api/<f>.keys.ts, hooks/use-invalidar-<f>.ts y los slots de acción
│   ├── pagos/  cuentas/  examenes/     #   (AccionCancelarTurno, AccionCancelarVarios, AccionFinalizarTurno,
│   │                                   #   AccionRegistrarPago, RegistrarPagoDialog, PagosDelAlumno, PagosGlobal,
│   │                                   #   ExamenesDelAlumno): placeholders con las props definitivas (T-46 a T-56)
│   ├── documentos/                     # AccionPdfTurno y BotonPdfAgenda (placeholders, T-60); sin datos propios: sin keys
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
│           ├── AlumnoDetalle.tsx        # ficha con pestañas en la URL (datos|turnos|examenes|pagos); las tres últimas llegan por render props
│           ├── DatosAlumno.tsx          # la pestaña "Datos"
│           ├── AlumnoNuevo.tsx, AlumnoEditar.tsx   # alta y edición en un <Panel> (modal)
│           └── AlumnoForm.tsx, AlumnoPanelEstado.tsx, AvisoMenorDeEdad.tsx, BotonNuevoAlumno.tsx
│
├── components/
│   ├── ui/                             # primitivos de UI hechos a mano (D-08/T-26)
│   ├── turno/                          # estado, pago y prioridad de un turno (T-33; ver Componentes compartidos del turno)
│   │   ├── indicadores-turno.ts        # tipos, mapeos estado → etiqueta/variante y texto del examen (con tests)
│   │   └── estado-turno-badge.tsx, estado-pago-badge.tsx, prioridad-indicador.tsx
│   └── layout/
│       ├── app-shell.tsx               # columna del Sidebar (logo + nav + usuario) + contenido
│       ├── page-header.tsx             # título, descripción y acción principal de cada pantalla
│       ├── sidebar-logo.tsx            # isotipo + wordmark, arriba de la columna (no es un link)
│       ├── sidebar-nav.tsx             # nav genérico (label + links con ícono); lo usan los de abajo
│       └── {mesa,profesor,gerente}-sidebar.tsx # uno por rol: <segmento>-sidebar.tsx, con sus propios links
│
├── hooks/{use-debounce.ts, use-toast.ts}   # use-toast: contexto y hook de los toasts
├── types/
│   ├── index.ts                        # PaginatedResponse<T>, Role, Auditoria y UsuarioAuditoria (contrato)
│   ├── ocurrencia.ts                   # OcurrenciaDetalle, OcurrenciaDeAlumno, acciones y renderDetalle: lo comparten varias features
│   └── agenda.ts                       # FiltrosAgenda (profesor, estado y prioridad)
└── utils/{cn.ts, fetch-json.ts, page-range.ts, initials.ts, caracteres.ts, dias-semana.ts, horas.ts, calendario.ts, formato-fechas.ts, auditoria.ts, moneda.ts}
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

| Rol              | `role` en la API | Segmento    | Layout y Sidebar                                   | Estado   |
| ---------------- | ---------------- | ----------- | -------------------------------------------------- | -------- |
| Mesa de entradas | `MESA_ENTRADAS`  | `/mesa`     | `app/mesa/layout.tsx` + `mesa-sidebar.tsx`         | Sprint 1 |
| Profesor         | `PROFESOR`       | `/profesor` | `app/profesor/layout.tsx` + `profesor-sidebar.tsx` | Sprint 1 |
| Gerente          | `GERENTE`        | `/gerente`  | `app/gerente/layout.tsx` + `gerente-sidebar.tsx`   | Sprint 2 |
| Alumno           | `ALUMNO`         | `/portal`   | `app/portal/layout.tsx` + `portal-sidebar.tsx`     | Sprint 3 |

- Cada segmento tiene su `page.tsx` en la raíz, que lleva a la primera pantalla del rol: ahí es donde caen el login y `/`, así que sin esa página serían un 404.
- La pantalla de una entidad para un rol va en `app/<segmento>/<entidad>/`. Si dos roles ven la misma entidad (por ejemplo, turnos), cada uno tiene su página (`/mesa/turnos`, `/profesor/turnos`) y las dos componen los mismos componentes de `features/turnos/`. La lógica no se duplica: vive en la feature.
- Por eso los componentes de una feature **no escriben el segmento del rol en sus links**: la página les pasa `rutaBase` (la URL del listado de la entidad en su segmento, por ejemplo `rutaBase="/mesa/alumnos"`) y el componente arma el resto (`${rutaBase}/nuevo`, `${rutaBase}/<id>`, `${rutaBase}/<id>/editar`).
- El segmento **no es seguridad**. El layout de cada rol monta `features/auth/components/SegmentoDeRol.tsx`, que, si el rol de la sesión no es el del segmento, muestra "No tiene permiso para acceder a esta sección" con un enlace a la pantalla de inicio del propio rol en lugar del contenido (HU-21): es comodidad de navegación, no un control de acceso, y sin sesión no hace nada. Lo que decide de verdad es el 403 de la API, que cada componente con datos muestra igual.
- **Acciones de escritura según el segmento.** Si dos roles ven la misma entidad pero solo uno escribe (materias: el gerente administra el catálogo y mesa de entradas lo lee, HU-12), la página de cada segmento se lo dice a la feature con una prop (`puedeEscribir`, por defecto `false`), igual que `rutaBase`. La feature no lee la sesión: `SegmentoDeRol` ya garantiza que en `/gerente` solo se ve el contenido con rol `GERENTE`. Sin permiso tampoco se montan los formularios que abriría la URL (`?editar=` se saca con `router.replace`) ni existen las rutas del alta en ese segmento. Es ayuda visual: lo que decide es el 403 de la API, que se muestra igual.
- La correspondencia rol → segmento vive en un solo lugar: `features/auth/roles.ts`. La usan `/` (que lee la sesión con `authClient.useSession()` y redirige al segmento del rol), `SegmentoDeRol` y el login. `ALUMNO` no tiene segmento todavía: para él la correspondencia es `null` y `/` muestra un aviso en lugar de mandarlo a un 404.
- No se usan route groups para separar roles. Si alguna vez se usan para otra cosa (compartir un layout sin cambiar la URL), dos route groups nunca pueden definir la misma ruta: los paréntesis no aparecen en la URL y el build falla.

## Layout: Sidebar

No hay una barra de Header separada: todo lo fijo de la app autenticada vive en una única columna (el Sidebar), y el contenido de la pantalla ocupa el resto.

- `app/layout.tsx` (raíz) solo monta `<Providers>`. No lleva el Sidebar: si lo llevara, también aparecería en `/login`.
- `components/layout/app-shell.tsx` arma esa columna, de arriba a abajo: `SidebarLogo` (isotipo, fijo), el `sidebar` que recibe por props (nav del rol, con scroll propio si no entra) y el `userMenu` que recibe por props (fijo, abajo, separado por un borde). El contenido va a la derecha.
- El `layout.tsx` de cada segmento de rol monta `<AppShell sidebar={<MesaSidebar />} userMenu={<UserMenu />}>{children}</AppShell>`.
- **`sidebar-logo.tsx`:** isotipo + "AulaClick", uno solo para todos los roles. No es un link: no hay una pantalla propia de "/" para un usuario logueado (`/` solo redirige según el rol).
- **`sidebar-nav.tsx`:** el nav genérico (una lista de `{ href, label, icon }` con el estado activo resuelto por `usePathname`). Lo usan `mesa-sidebar.tsx`, `profesor-sidebar.tsx` y `gerente-sidebar.tsx`, que solo aportan su propio array de links y el título de sección; evita repetir la lógica de estado activo entre roles sin dejar de tener "un archivo por rol" (`<segmento>-sidebar.tsx`) como pide la tabla de arriba.
- **Menú de usuario** (avatar, nombre, rol y un menú con "Cerrar sesión"): `features/auth/components/UserMenu.tsx`. `components/` no puede importar de `features/` (ESLint), así que todo lo que depende de una feature le llega a `AppShell` por props, armado en el layout del segmento.

## Documentos imprimibles

Patrón común para los documentos oficiales que se guardan como PDF desde el diálogo de impresión del navegador, en A4 y sin el sidebar ni los botones de la app.

- **Datos y logo del centro: los da la API** (T-64), precargados y sin pantalla para editarlos (HU-11). El front no tiene constantes del centro ni el logo en `public/`.
  - **`features/centro/`**: `useCentro()` pide `GET /api/v1/centro` (nombre, dirección y teléfono) con `staleTime: Infinity`, porque casi no cambian.
  - El logo se muestra con `<img src="/api/v1/centro/logo">` (misma sesión, sin fetch propio).
- **`components/impresion/DocumentoOficial.tsx`**: `DocumentoOficial({ titulo, emitidoPor, centro, onLogoListo, children })`, el encabezado común (logo, datos del centro, título, quién emite y la fecha/hora de emisión del navegador, con `date-fns`) más el contenido propio de cada documento, que llega por `children`. Recibe `centro` por props: `components/` no puede importar de `features/` (ESLint), así que `useCentro()` lo llama quien arma el documento. `onLogoListo` se llama en el `onLoad`/`onError` del logo.
- **`app/impresion.css`** (importado una sola vez en `app/layout.tsx`): fija `@page { size: A4 }` con márgenes, y en `@media print` oculta todo lo marcado con el atributo `data-no-imprimir` — así en la vista previa de impresión solo queda el documento. `app-shell.tsx` marca su `<aside>` (el Sidebar) con ese atributo.
- **`hooks/use-imprimir.ts`**: `useImprimirCuandoEsteListo(listo: boolean)` llama a `window.print()` una sola vez, apenas `listo` pasa a `true`. `listo` incluye los datos del documento, los del centro y que el logo haya terminado de cargar, para que no salga un encabezado sin logo.
- Cada documento concreto (comprobante, turno, agenda) es su propia ruta (`/…/imprimir` o `/…/comprobante`, por ejemplo `/mesa/pagos/[id]/comprobante`), sin el layout del segmento de rol (para que el Sidebar no aparezca ni siquiera antes de imprimir), que arma su Client Component con `useCentro`, `DocumentoOficial` y `useImprimirCuandoEsteListo`:

  ```tsx
  'use client'

  import { useState } from 'react'

  import { DocumentoOficial } from '@/components/impresion/DocumentoOficial'
  import { useCentro } from '@/features/centro/hooks/use-centro'
  import { useImprimirCuandoEsteListo } from '@/hooks/use-imprimir'

  export function ComprobantePage() {
    const { data } = useComprobante(id) // hook de la feature
    const { data: centro } = useCentro()
    const [logoListo, setLogoListo] = useState(false)

    useImprimirCuandoEsteListo(!!data && !!centro && logoListo)

    if (!data || !centro) return null // nada que imprimir todavía

    return (
      <DocumentoOficial
        titulo="Comprobante de pago"
        emitidoPor={data.emitidoPor}
        centro={centro}
        onLogoListo={() => setLogoListo(true)}
      >
        {/* contenido propio del comprobante */}
      </DocumentoOficial>
    )
  }
  ```

- No se agrega ninguna dependencia nueva: se usa el diálogo de impresión nativo del navegador (`window.print()`), no una librería de generación de PDF.

## Acciones sobre una ocurrencia: slots compuestos desde `app/`

Una **ocurrencia** es un turno en una fecha concreta (`docs/sprint-2/sprint-2.md` → Vocabulario). Varias features muestran algo en las mismas pantallas —el detalle del turno, la ficha del alumno, la agenda—, y una feature no importa componentes de otra. El patrón, ya usado con `renderAgenda`, es un **slot**: la feature dueña de la pantalla recibe una prop de render y `app/` la completa con los componentes de las demás.

- **Detalle del turno.** `OcurrenciaDetalle({ turnoId, fecha, onCerrar, renderAcciones })` (`features/ocurrencias`) muestra el turno y le pasa la ocurrencia a `renderAcciones`. Cada segmento lo compone en `app/<segmento>/_componentes/detalle-turno.tsx`: mesa de entradas con `AccionReprogramarTurno`, `AccionCancelarTurno`, `AccionFinalizarTurno`, `AccionRegistrarPago` y `AccionPdfTurno`; el profesor, sin acciones. Las pantallas que lo abren (agendas, alta de turno) reciben `renderDetalle={(d) => <DetalleTurno {...d} />}` y `app/` lo pasa desde su página (que por eso es un Client Component).
- **En la URL.** `?detalle=<turnoId>&fecha=<fechaOriginal>` sobre la pantalla que lo muestra (`useDetalleEnUrl`, `features/ocurrencias/hooks/`, con `detalle-url.ts` como único lugar que conoce los parámetros). La fecha es la **original** de la ocurrencia, la que la identifica aunque se reprograme. En las agendas `fecha` es también el día o la semana que se ve, así que abrir el detalle de una ocurrencia reprogramada mueve la vista.
- **Ficha del alumno.** `AlumnoDetalle` recibe `renderTurnos`, `renderExamenes` y `renderPagos`; `app/mesa/_componentes/ficha-alumno.tsx` los completa con `TurnosDelAlumno` (con `renderAccionesSeleccion` = `AccionCancelarVarios`), `ExamenesDelAlumno` y `PagosDelAlumno` (con `renderRegistrarPago` = `RegistrarPagoDialog`). La ficha del profesor solo trae Exámenes. `/mesa/pagos` compone `PagosGlobal` igual.
- **Agendas.** Las tres reciben `renderDetalle`; la diaria, además, `renderPdf` (el `BotonPdfAgenda`, de `features/documentos`) y el calendario semanal es `CalendarioSemanal`.
- **Tipos compartidos.** Lo que cruza features vive en `src/types/` para que ninguna importe los `types` de otra: `ocurrencia.ts` (`OcurrenciaDetalle`, `OcurrenciaDeAlumno`, `SolicitudDetalleOcurrencia`) y `agenda.ts` (`FiltrosAgenda`). Los args de los `render*` son exactamente las props del componente que los completa, así `app/` los pasa con un spread.
- **Una acción se muestra según `ocurrencia.acciones`**, que calcula la API (`cancelar: { visible, habilitada, motivo? }`, `finalizar`, `reprogramar`, `registrarPago`), y nunca con reglas propias del cliente: si un turno se puede cancelar, cuánto cuesta o qué prioridad tiene lo dice la API. Lo mismo vale para la casilla de selección de la lista de turnos del alumno (`cancelable`).
- **Placeholders.** Mientras una HU no se completa, su componente existe con sus props definitivas y devuelve `null` o un aviso "Próximamente": cada tarea solo completa su archivo. Los `types/ocurrencia.ts` siguen el contrato de T-43 y los ajusta T-44.

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

El **detalle de una entidad sencilla** (una hora del horario, una materia y otras con pocos datos y sin secciones propias) no es una página: es un **modal de solo lectura** con `DetalleModal` de `components/ui/` (decisión T-34). La feature solo arma sus datos con `Datos` / `Dato` y le pasa la query (`cargando`, `error`, `onReintentar`) y la auditoría: el modal resuelve la carga, el 404, el 403, la sección "Trazabilidad" y el pie con "Cerrar" y las acciones (por ejemplo, un link a la edición). Se abre con un parámetro de la pantalla que queda de fondo, con el mismo criterio que `?editar=<id>` (en el horario del profesor, `?tab=horario&detalle=<id>`), y se cierra también con un clic afuera: no hay nada que perder.

El **detalle** de una entidad con secciones propias es una **página** (`[id]/page.tsx`), con tabs cuando tiene más de una sección: la ficha del alumno tiene `?tab=datos|turnos|examenes|pagos` (sin `tab`, "Datos") y una pestaña aparece solo si `app/` le pasó su render prop (`renderTurnos`, `renderExamenes`, `renderPagos`): mesa de entradas ve las cuatro y el profesor, Datos y Exámenes; con una sola pestaña no se envuelve en `Tabs`. El **alta** y la **edición** se abren **siempre como modal**, encima de la pantalla desde la que se abrieron: el alta y la edición desde el lápiz de una fila, encima del listado; la edición desde "Editar" del detalle, encima de la página de detalle. Entrando por URL o al recargar, cada modal queda sobre la misma pantalla. Todas tienen URL propia (`/mesa/alumnos/nuevo`, `/mesa/alumnos/12/editar`, `/mesa/alumnos?editar=12`), así que se pueden compartir y Atrás cierra el modal. El alta y la edición desde el detalle usan el patrón de Next de Parallel + Intercepting Routes (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md` → Modals); `alumnos` es el modelo:

- Hay dos slots `@modal`, cada uno en el layout de la pantalla que queda de fondo: `app/<segmento>/<entidad>/layout.tsx` (alta, sobre el listado) y `app/<segmento>/<entidad>/[id]/layout.tsx` (edición, sobre el detalle). Los dos renderizan `{children}` y `{modal}` (tipado con `LayoutProps`, que ya trae `modal`).
- **Navegando:** `@modal/(.)nuevo/page.tsx` (desde el listado) y `[id]/@modal/(.)editar/page.tsx` (desde el detalle) interceptan la navegación y muestran el componente de la feature con `mode="modal"`. `children` sigue siendo la pantalla de fondo, con su estado (el `q` y la `page` del listado, el tab del detalle).
- **Nunca una carpeta interceptora con parámetro dinámico** (`@modal/(.)[id]/…`). En Next 16, con `pnpm dev`, cada recompilación le vuelve a agregar el `(.)` al parámetro (`Invalid interception route: /mesa/alumnos/(.)(.)(.)2/editar`, o `alumnoId` llega como `"(.)2"`). La navegación del cliente falla con un 500 y el navegador recarga la página entera, sin intercepción. Recién reiniciado funciona, así que el error aparece y desaparece.
- **Edición desde el lápiz del listado:** por eso no es una ruta interceptada, sino un parámetro del listado, `?editar=<id>` (se suma a `q` y `page`). `<Entidad>Listado` lo lee y muestra `<Singular>Editar` con `mode="modal"`. El lápiz lo agrega con un `Link` (`push`, así Atrás cierra el modal); cerrar o guardar es `router.back()` si se abrió con el lápiz en esa pestaña, o `router.replace` sin `editar` si se entró por URL.
- **Edición de una entidad sencilla (materias):** como el detalle es un modal `?detalle=<id>` sobre el listado y no una página, la edición también es un parámetro del listado, `?editar=<id>`. Se abre con el lápiz de la fila (como en alumnos y profesores) o con "Editar" del detalle, un `Link` (`push`) que cambia `detalle` por `editar`, igual que el horario del profesor pasa de `?detalle=` a `?bloque=`. `MateriasListado` cuenta los modales que abrió con un link: cerrar o guardar hace `router.back()` mientras queden (edición → detalle → listado, o edición → listado desde el lápiz) y, entrando por URL, `router.replace` al detalle de esa materia.
- Después de crear, mover o borrar carpetas de rutas, **reiniciar `pnpm dev`**: con el árbol de rutas viejo en memoria, las rutas nuevas o borradas se comportan mal.
- **Entrando por URL o al recargar:** no hay intercepción. `nuevo/page.tsx` renderiza el listado de fondo (`<Entidad>Pantalla`, el mismo componente que usa `page.tsx`) y `[id]/editar/page.tsx` el detalle; el modal lo ponen `@modal/nuevo/page.tsx` y `[id]/@modal/editar/page.tsx`, las rutas de cada slot sin `(.)`.
- Rutas del slot que devuelven `null`: `default.tsx`, para la carga por URL de una ruta que el slot no define; `page.tsx`, para que volver a la pantalla de fondo (un `Link` al listado, como el del Sidebar, o `router.replace` al detalle) cierre el modal; y `@modal/[id]/page.tsx` en el slot del listado, para que ir al detalle no deje un modal del listado abierto. Sin ellas, en una navegación del cliente el slot conserva el último modal abierto.
- `AlumnoNuevo` y `AlumnoEditar` se arman con `Panel` de `components/ui/` y **no navegan solos**. Quien los monta les pasa qué hacer al cerrar o al guardar:
  - **Interceptada:** cerrar es `router.back()` (vuelve al listado con su `q` y su `page`, o al detalle); guardar también, tanto el alta como la edición. Tras un alta se vuelve al listado, que ya se invalidó y muestra al alumno nuevo.
  - **Por URL:** puede no haber historial dentro de la app. Cerrar el alta va al listado con `router.push` y crear, con `router.replace` (Atrás no reabre el formulario). Cerrar o guardar la edición vuelve al detalle con `router.replace`.
- **Tab del detalle y formularios de una sección:** el tab activo del detalle va en la URL (`?tab=materias`, `?tab=horario`, `?tab=agenda`; sin `tab`, el primero), con `router.replace` para que cambiar de tab no sume entradas al historial. Así, un formulario que vive dentro de un tab se abre con un parámetro más, con el mismo criterio que `?editar=<id>` (sin interceptor con parámetro dinámico): el horario del profesor usa `?tab=horario&bloque=nuevo` (alta) y `?tab=horario&bloque=<id>` (edición de esa hora), y `HorarioProfesor` monta el `Panel` modal. Se abre con un `Link` (`push`: Atrás lo cierra); cerrar o guardar es `router.back()` si se abrió desde la sección en esa pestaña, o `router.replace` a `?tab=horario` si se entró por URL. La URL sigue la misma ayuda visual que los botones: si la sección no ofrece ese formulario (profesor inactivo, o alta sin materias asignadas), no lo monta y, una vez que lo sabe, saca el parámetro con `router.replace`. Convive con el slot `@modal` de la edición del profesor, que es otra ruta (`[id]/editar`). El detalle lee la URL con `useSearchParams`, así que su página lo monta dentro de `<Suspense>`. Las confirmaciones (por ejemplo, eliminar un bloque) son un `Dialog` sin URL propia.
- **Agendas por rango (vista por día o por semana):** "Mi agenda" (`/profesor/agenda`) y el tab "Agenda" de la ficha del profesor comparten `AgendaPorRango` (navegación, selector, tabla, error y pie; controlado, no conoce el endpoint) y el hook `useRangoAgendaEnUrl({ vistaPorDefecto })`, que guarda `vista` y `fecha` en la URL con `router.replace` sobre la ruta actual y conserva los demás parámetros (el `tab`). Los parámetros los arma `paramsDeRango` (`features/agendas/agenda-propia.ts`, con tests): omite la vista por defecto y el rango de hoy, y en la vista semanal guarda el lunes. "Mi agenda" es por día por defecto (`?vista=semana&fecha=…`); la ficha, por semana (`?tab=agenda&vista=dia&fecha=…`). Cada contenedor elige su hook de datos (`useAgendaPropia` o `useAgendaProfesor`) y su texto para el 404. Cambiar de tab descarta `vista` y `fecha`: al volver, se ve la semana actual.
- **Las tres agendas comparten `AgendaConModo`** (diaria, de un profesor y "Mi agenda"): el selector **Calendario / Lista** (HU-19), el detalle del turno abierto desde la URL y un lugar para acciones del encabezado (el PDF de la agenda diaria). El modo va en la URL (`?modo=calendario`, `use-modo-agenda.ts`; `modo-agenda.ts` es el único lugar que conoce el parámetro), no se recuerda entre visitas y por defecto es la lista. Lista y calendario se montan de a uno, así el que no se ve no pide datos. Los **filtros** (`profesorId`, `estado` y `prioridad`) viven en la URL (`use-filtros-agenda.ts`, `filtros-agenda.ts` con tests) y valen igual en las dos vistas; cambiar un filtro vuelve a la página 1. `estado` y `prioridad` todavía no tienen controles (T-58).
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
- Las query keys salen solo de `<entidad>.keys.ts`. Una mutación invalida las keys de su entidad. Si además cambia datos que cachea otra feature, la invalida con un hook que esa feature expone (por ejemplo `useInvalidarAulas` de `features/aulas/hooks/`, que usan las mutaciones de bloques, o `useInvalidarMaterias`, que tienen que usar las de asignar y quitar materias a un profesor: el detalle de la materia lista sus profesores; o `useInvalidarHorarioDe` de `features/profesores/hooks/use-invalidar-horario.ts`, que recibe el profesor al invocarla y usa el alta de turnos porque el horario muestra la ocupación, T-33; las mutaciones de bloques usan `useInvalidarHorario(profesorId)`, que es la misma con el profesor fijo), no importando sus keys: de otra feature solo se usan sus hooks. Cada feature de datos tiene el suyo (`useInvalidarAgendas`, `useInvalidarOcurrencias`, `useInvalidarCancelaciones`, `useInvalidarFinalizaciones`, `useInvalidarPagos`, `useInvalidarCuentas`, `useInvalidarExamenes`): una mutación que cambia una ocurrencia invalida, además de lo suyo, las agendas, las ocurrencias y las cuentas que la muestran (el alta de turnos ya invalida agendas y ocurrencias).
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
  - Prioridad del turno (HU-18): `prioridad-alta` (rojo) y `prioridad-media` (amarillo), más vivos que `cancelado` y `urgente` para que no se confundan con un estado. Los usa solo `components/turno/prioridad-indicador.tsx`.
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

### Componentes compartidos del turno

El estado de un turno en una fecha, su estado de pago y su prioridad se muestran en las agendas, el calendario, el detalle del turno, la ficha del alumno y los pagos. Viven en `components/turno/` (T-33): reciben **props planas** con los valores que manda la API y no importan de `features/`. No calculan nada: el estado, el pago, la prioridad y los días hasta el examen los decide la API (HU-18). Los tipos (`EstadoTurno`, `EstadoPago`, `Prioridad`, `ExamenPrioridad`) y los mapeos están en `indicadores-turno.ts`, con sus tests.

| Componente           | Props                                                                                                         | Qué muestra                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EstadoTurnoBadge`   | `estado: 'AGENDADO' \| 'CANCELADO' \| 'SIN_REGISTRAR'`, `className?`                                          | Un `Badge`: "Agendado" (`confirmado`), "Cancelado" (`cancelado`), "Sin registrar" (`secondary`). La HU de estados está "a definir": etiqueta y color salen solo de `ESTADO_TURNO`; si cambian, se cambian ahí.                 |
| `EstadoPagoBadge`    | `estado: 'PENDIENTE' \| 'PAGADO'`, `className?`                                                               | Un `Badge`: "Pendiente" (`pendiente`), "Pagado" (`confirmado`). Mapeo en `ESTADO_PAGO`.                                                                                                                                        |
| `PrioridadIndicador` | `prioridad: 'ALTA' \| 'MEDIA' \| 'BAJA'`, `examen?: { materiaNombre, fecha, dias }`, `variante`, `className?` | Punto de color con la palabra ("Alta" en rojo, "Media" en amarillo), un canal distinto del badge de estado. El `examen` de la API (con `id` y `tipo`) se pasa entero. Una ocurrencia cancelada no trae prioridad: no se monta. |

Variantes de `PrioridadIndicador`:

- **`fila`** (tablas de las agendas): franja lateral + punto + palabra. La franja se apoya en el borde izquierdo del ancestro posicionado más cercano, así que va en la **primera celda de la fila, con `relative`** (`<TableCell className="relative">`). **Baja no muestra nada.**
- **`punto`** (listas compactas, el bloque expandido del calendario): punto + palabra, sin franja. **Baja no muestra nada.**
- **`detalle`** (detalle del turno): punto + palabra + el examen escrito debajo ("Examen de Matemática el 15/10 (en 5 días)", o "Sin examen próximo en esta materia"). Es la única variante en la que se lee **Baja** (con un punto hueco, sin color).

En `fila` y `punto`, si viene `examen`, la palabra es un botón con el `Tooltip` de `components/ui/` que muestra el examen que determina la prioridad: se abre con el mouse y con el foco del teclado (trae su propio `TooltipProvider`). Texto: `textoExamenPrioridad` (`date-fns`, `dd/MM`); los días se cuentan desde la fecha del turno, así que 0 se lee "el mismo día del turno", no "hoy". En pantallas táctiles el tooltip no se abre al tocar: el examen se lee en el detalle.

Accesibilidad: el color nunca es el único canal (siempre está la palabra, y el lector de pantalla oye "Prioridad Alta"); la franja y el punto son `aria-hidden`.

## Tests

El alcance de los tests de frontend es la decisión abierta D-09. Hasta decidirlo, los tests automatizados cubren el backend, el matcher de `proxy.ts` y las funciones puras del frontend (`pnpm test:run`), como `features/auth/interpretar-error-login.ts`, `features/alumnos/edad.ts`, las del horario del profesor (`features/profesores/horario.ts`: agrupar las horas en bloques y las opciones de hora; `errores-bloques.ts`: los errores de la API de bloques en texto para la UI; `turnos-vigentes.ts`: el resumen y el texto de vigencia de los turnos que impiden la baja; y las conversiones del formulario de bloques de `profesores.schema.ts`) las de turnos (`features/turnos/turnos.schema.ts`: el body del alta; `errores-turnos.ts`: los errores del alta en lo que muestra la pantalla; `formato-turnos.ts`: horarios y rangos de fechas; `seleccion-turno.ts`: el bloque elegido y el agrupado del alta; `alumnos/volver-a.ts`: la lista blanca de `volverA`), las de `agendas` (`agenda-propia.ts`: el rango de la vista por día o por semana, el agrupado por fecha y los parámetros de la URL de las agendas por rango; `filtros-agenda.ts`: los filtros en la URL), `ocurrencias/detalle-url.ts` (los parámetros `?detalle=&fecha=`), las de `components/turno/indicadores-turno.ts` (mapeos de estado, pago y prioridad y el texto del examen) y las de `utils/` (`page-range.ts`, `initials.ts`, `caracteres.ts`, `dias-semana.ts`, `horas.ts`, `calendario.ts`, `formato-fechas.ts`, `auditoria.ts`). `vitest.config.mts` recoge solo `src/**/*.test.ts`: un test de componente (`.tsx`, con Testing Library y jsdom) necesita además cambiar ese `include` y agregar esas dependencias, que es justamente lo que decide D-09.
