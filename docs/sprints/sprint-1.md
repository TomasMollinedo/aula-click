# Sprint 1 — Tareas (HU-00 a HU-10)

Repositorio: `aula-click` · Sprint: Iteración 1 · Estado inicial de todas las tareas: **Todo**

Estas tareas siguen `AGENTS.md` y `docs/`. Si una tarea y un doc se contradicen, manda el doc y se avisa para corregir la tarea.

T-01 a T-13 salieron del backlog anterior; T-14 en adelante, del **Product Backlog v4**. Cuando el v4 cambió algo que una tarea ya mergeada daba por cerrado, la tarea vieja **no se borra ni se edita**: se agrega una tarea nueva marcada **FIX** (T-14, T-15, T-16 y T-27) que dice qué cambia y por qué, y así queda visible qué se acordó en cada momento.

**Fuera del Sprint 1:** HU-08 (exámenes del alumno y "Mis alumnos" del profesor) y, con ella, la **prioridad** del turno pasan al Sprint 2. HU-11 no entra todavía.

## Orden y dependencias

```
Día 1 (en paralelo):
  T-01 Modelo de datos + migración + seed ──┐
  T-02 src/server/shared/ ──────────────────┼──> T-03 Autenticación y roles (API)
                                            │         │
                                            │         └──> T-04 Login y layout por rol (UI)
                                            │
                                            └──> T-05 Alumnos API · T-07 Profesores API · T-09 Materias API
                                                     │                  │                   │
                                                 T-06 Alumnos UI    T-08 Profesores UI  T-10 Materias UI
                                                                        │                   │
                                                                        └──── T-11 Materias asignadas API (T-07 + T-09)
                                                                                    │
                                                                              T-12 Materias asignadas UI (T-08 + T-11)
```

- **T-01 y T-02 son bloqueantes y arrancan el día 1.** T-02 no depende del schema (`convenciones-backend.md` → Estado), así que no espera a T-01.
- **T-13** (paleta, tokens y primitivos de UI) tampoco depende del schema y puede arrancar el día 1 en paralelo. No bloquea a nadie, pero conviene que esté mergeada antes de que T-06, T-08 y T-10 construyan sus pantallas, para no reescribirlas después.
- Nadie genera migraciones propias hasta que T-01 esté mergeada.
- Las APIs necesitan T-01, T-02 y T-03. Las pantallas pueden empezar en paralelo con su API, contra el contrato de `docs/contrato-api.md` y el OpenAPI (`/api/v1/docs`), y se conectan cuando la API se mergea.
- `alumnos` es la feature modelo que copian las demás (`/nueva-feature-api`, `/nueva-feature-ui`). Conviene que T-05 y T-06 abran su PR temprano para que profesores y materias sigan el mismo patrón.

Tareas del backlog v4 (HU-05 a HU-10 y las correcciones), a partir de lo ya mergeado:

```
T-14 FIX modelo (aulas, capacidad del profesor, turno por hora) ──┬──> T-15 FIX capacidad API ──> T-16 FIX capacidad UI
                                                                  │
                                                                  ├──> T-17 Bloques API (+ T-11) ──> T-18 Bloques UI
                                                                  │            │
                                                                  │            └──> T-21 Turnos API (+ T-05) ──> T-22 Turnos UI
                                                                  │                        │
                                                                  │                        └──> T-23 Agenda diaria API ──> T-24 Agenda diaria UI
                                                                  │                                    │
                                                                  │                                    └──> T-25 Agenda profesor API ──> T-26 Agenda profesor UI
                                                                  │
En paralelo, sin depender de T-14:  T-19 Baja/reactivación API ───┴──> T-20 Baja/reactivación UI
```

- **T-14 es bloqueante** para T-15, T-17 y T-21: cambia el schema y lleva migración. Igual que con T-01, nadie genera migraciones en paralelo hasta que esté mergeada.
- **T-19 y T-20 (HU-06) no dependen de T-14:** usan la consulta de turnos vigentes que ya dejó T-11, así que pueden arrancar apenas se decida quién las toma.
- **T-25 y T-26 (HU-10) son opcionales**, como la HU: se hacen sólo si sobra margen, y después de HU-09.
- La cadena larga del sprint es T-14 → T-17 → T-21 → T-23: conviene tomarla temprano y en PRs chicos, porque todo lo de turnos y agenda cuelga de ahí.

## Definición de Hecho (aplica a todas las tareas)

- Rama creada desde `main` con el nombre indicado; PR a `main` que referencia el issue (`Closes #N`). Nadie commitea directo a `main`.
- `pnpm check` pasa localmente y en el CI.
- `/revisar-arquitectura` no reporta violaciones.
- Backend: cada endpoint declarado con `createRoute()`, con todos sus status codes, errores con `ErrorResponseSchema`, y `requireAuth()` + `requireRole(...)`. Un test por service con el repository mockeado: camino feliz y un caso por cada error que lanza (`it.todo` no cuenta).
- Frontend: cada componente con datos maneja carga, vacío y error (401/403/404); llamadas sólo por `fetchJson` desde `features/<entidad>/api/`; ninguna regla de negocio calculada en el cliente.
- Nada se borra físicamente: las bajas son lógicas (`estado`).
- Si el cambio toca el contrato de la API, una regla o la estructura, se actualiza el doc correspondiente en el mismo PR (`AGENTS.md`, regla 9).
- Al menos un integrante que no sea el autor revisa la PR.

---

## T-01 · [Back] Modelo de datos: esquema Prisma desde el DER, migración inicial y seed

- **HU:** Transversal (habilita HU-00 a HU-11)
- **Área:** Backend
- **Rama:** `feat/modelo-datos-inicial`
- **Prioridad:** Bloqueante, se mergea el día 1

**Descripción**
Traducir el DER aprobado a `prisma/schema.prisma` y generar la migración inicial, de modo que todas las tablas existan desde el comienzo del sprint y cada integrante pueda trabajar su feature sin tocar el modelo base. Incluye un seed con un usuario por rol, porque en este release no hay ABM de usuarios de mesa de entradas ni de gerencia.

**Alcance**

1. Modelar todas las entidades del DER, no sólo las de este sprint: `Rol`, `Usuario`, `Profesor`, `Alumno`, `Materia`, `AsignacionMateria`, `BloqueAgenda`, `Turno` y `TurnoExcepcion`, con sus relaciones.
2. `Usuario` es la entidad de Better Auth: se integran las tablas que Better Auth necesita (sesión, cuenta, verificación) sobre ese mismo modelo, sin crear una segunda tabla de usuarios. `Profesor` referencia a `Usuario` con una FK obligatoria y única.
3. Valores de rol: `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO` (`contrato-api.md` → Roles). Un solo rol por usuario.
4. Enum `estado` (`ACTIVO` / `INACTIVO`) en las entidades que lo tienen en el DER.
5. Auditoría: en Prisma los campos se llaman `createdById`, `updatedById`, `createdAt` y `updatedAt` (`convenciones-backend.md`). Si el DER usa otros nombres de columna (`fecha_hora_creacion`, etc.), se mapean con `@map`. `Profesor` no lleva auditoría propia: la toma de su `Usuario`.
6. Fechas de calendario como `@db.Date` y horas como minutos desde medianoche (`Int`).
7. Columna derivada `busqueda` (texto normalizado con `normalizarBusqueda()`; ver T-02):
   - En alumnos y profesores: apellido, nombre y DNI. En profesores va donde el DER ubique los datos personales.
   - En materias: el nombre. Lleva `UNIQUE`, y así resuelve también la unicidad sin distinguir mayúsculas ni tildes ("Matemática" y "matematica" chocan).
   - No se usa la extensión `unaccent`.
   - Como `convenciones-backend.md` hoy menciona la columna sólo para alumnos y profesores, se actualiza en este PR para incluir materias.
8. Restricciones de unicidad: DNI de alumno, DNI y matrícula de profesor, email de usuario y `busqueda` de materia. Índices en los campos de orden (apellido).
9. Seed en `prisma/seed.ts`, registrado en `prisma7.config.ts`:
   - Idempotente (`upsert`), para poder correrlo varias veces.
   - Crea un usuario `MESA_ENTRADAS`, un `PROFESOR` (con su registro en `Profesor`, estado `ACTIVO`) y un `GERENTE` (no se usa en este sprint, pero queda disponible). El usuario alumno se agrega cuando se implemente el portal (Sprint 3).
   - No puede usar `auth.api.signUpEmail`, porque con `disableSignUp` queda bloqueado (decisión T-21). Las cuentas se crean escribiendo `Usuario` y su cuenta de tipo credencial, con la contraseña hasheada por el helper de hash que expone `src/lib/auth.ts` (ver T-03). Así el seed y el alta de profesor usan el mismo mecanismo.
   - Emails y contraseñas por variables de entorno, agregadas a `.env.example`.
   - Carga unas materias de ejemplo para que el frontend tenga datos.
10. Actualizar `docs/decisiones.md`: D-05 (creación de cuentas con el registro deshabilitado) y D-10 (vínculo cuenta ↔ profesor: FK de `Profesor` a `Usuario`, cuenta creada por mesa de entradas con contraseña inicial) pasan a "Tomadas". Actualizar también `docs/dominio.md` → Roles.
11. La migración la genera y la aplica la persona con `pnpm db:migrate`, no un agente de IA (`AGENTS.md`, regla 10). Documentar en el README cómo levantar servicios, migrar y correr el seed.

**Criterios de aceptación**

- Con la base vacía, `pnpm db:migrate` y el seed dejan todas las tablas del DER y los usuarios de prueba.
- Correr el seed dos veces no duplica datos ni falla.
- Un insert duplicado de DNI, matrícula, email o nombre de materia (con otra capitalización o sin tilde) falla a nivel de base.
- Los usuarios del seed pueden iniciar sesión una vez mergeada T-03.

---

## T-02 · [Back] Construcción de `src/server/shared/`

- **HU:** Transversal (habilita HU-01 a HU-03 y siguientes)
- **Área:** Backend
- **Rama:** `feat/server-shared`
- **Prioridad:** Bloqueante, arranca el día 1 (no depende del schema)

**Descripción**
Construir, en un PR propio, las piezas de `src/server/shared/` marcadas como **A construir**, siguiendo exactamente la especificación de `docs/convenciones-backend.md`. Todas las features dependen de ellas y ninguna puede reimplementarlas.

**Alcance**

1. `actor.ts`: tipo `Actor` y constante `ROLES` con los valores de `contrato-api.md` → Roles.
2. `paginacion.ts`: `paginacionQuerySchema`, `paginatedSchema`, `calcularSkipTake` y `armarMeta`.
3. `zod.ts`: `dni`, `email`, `telefono`, `textoRequerido`, `fechaISO`, `horaHHmm`, `horaAMinutos` y `minutosAHora`.
4. `busqueda.ts`: `normalizarBusqueda()`.
5. `fechas.ts`: `hoy(reloj?)`, `fechaADate`, `dateAFecha` y `diaSemanaISO`.
6. Tests reales de cada archivo en `shared/__tests__/`, incluidos los obligatorios: `hoy()` a las 23:30 hora Salta devuelve el día correcto, y `normalizarBusqueda` con los ejemplos del doc.
7. Regla de ESLint: `src/server/shared/**` no importa de `features` ni Prisma. Probarla en negativo y en positivo.
8. Actualizar la tabla "Estado" de `convenciones-backend.md`.

**Criterios de aceptación**

- Todas las funciones de la especificación existen con esas firmas y tienen tests.
- `"González"` → `"gonzalez"` y `"  Ñandú  Pérez "` → `"nandu perez"`.
- Un import de una feature desde `shared/` hace fallar `pnpm lint`.

---

## T-03 · [Back] HU-00 · Autenticación, sesión y control de acceso por rol

- **HU:** HU-00 Inicio de sesión en el sistema
- **Área:** Backend
- **Rama:** `feat/auth-api`
- **Depende de:** T-01, T-02

**Descripción**
Dejar Better Auth cerrado a registro público y resuelta en la API la identificación del usuario y la restricción por rol, para que cada endpoint sólo declare qué roles admite.

**Alcance**

1. `src/lib/auth.ts`:
   - `emailAndPassword.disableSignUp: true` (`convenciones-backend.md` → Seguridad de cuentas).
   - Campo `role` con los valores definidos y `input: false`.
   - Exponer el helper de hash de contraseñas que usan el seed y el alta de profesor, basado en el mecanismo de Better Auth (verificar la API en la versión instalada). Nunca un hash hecho a mano.
2. Sesión con vencimiento por inactividad: se renueva con la actividad y vence tras un período sin uso (60 minutos, confirmado por los PO: decisión T-24).
3. Bloquear el inicio de sesión de un profesor en estado `INACTIVO` con un error propio y el mensaje "Su usuario no está habilitado". El código de error nuevo se agrega a `contrato-api.md`.
4. Ante credenciales incorrectas, el mismo error siempre, sin indicar si falló el email o la contraseña.
5. `requireAuth()` deja el `Actor` en el contexto (`c.set('actor', ...)`, con `actor` en `AppEnv`); responde 403 `SIN_PERMISO` si el usuario no tiene rol. `requireRole(...)` recibe roles de `ROLES`.
6. `src/proxy.ts`: matcher negativo que protege todo salvo `/login`, `/api/*`, internos de Next y estáticos (decisión T-14). Sigue sin decidir roles.
7. Actualizar `arquitectura-backend.md` (sección Autenticación) y `convenciones-backend.md` → Estado.

**Criterios de aceptación**

- `POST /api/auth/sign-up/email` con un cuerpo válido responde 400 y no crea la cuenta.
- Los usuarios del seed inician y cierran sesión.
- Un profesor inactivo no puede iniciar sesión y recibe el error propio.
- Un endpoint de `/api/v1` responde 401 sin sesión y 403 con un rol no permitido.
- Tests del middleware (con `vi.mock('@/lib/auth')`) y del bloqueo de profesor inactivo.

---

## T-04 · [Front] HU-00 · Login, cierre de sesión y layout por rol

- **HU:** HU-00 Inicio de sesión en el sistema
- **Área:** Frontend
- **Rama:** `feat/auth-ui`
- **Depende de:** T-03 (puede empezar en paralelo)

**Descripción**
Implementar el ingreso al sistema y el esqueleto de navegación que usan todas las pantallas del sprint, siguiendo `docs/arquitectura-frontend.md`.

**Alcance**

1. `features/auth/`: `auth-client.ts` (`createAuthClient` de `better-auth/react`, con `role` tipado en el cliente) y `LoginForm`.
2. `/login` (fuera de los layouts de rol): email y contraseña obligatorios, contraseña enmascarada. Credenciales incorrectas → "Usuario o contraseña incorrectos". Profesor inactivo → "Su usuario no está habilitado". Sin pantalla de registro.
   - El texto sale del `code` que devuelve `authClient.signIn.email` (formato de Better Auth, con `message` en inglés): `INVALID_EMAIL_OR_PASSWORD` (401) y `USUARIO_INHABILITADO` (403). Ver `contrato-api.md` → Autenticación.
   - No mandar `rememberMe`: la sesión vence siempre por inactividad (T-24) y la API ignora ese valor.
3. Segmentos de URL por rol (decisión T-19): migrar `(personal-mesa-entradas)` a `app/mesa/` y crear `app/profesor/`. `/gerente` y `/portal` no se crean en este sprint.
   - **Hecho (fuera de esta tarea):** la migración de `(personal-mesa-entradas)` a `app/mesa/` ya está en `main`, al detectarse la deriva contra T-19 (incluye `mesa-sidebar.tsx` / `MesaSidebar` y los `href` a `/mesa/...`). **Falta:** crear `app/profesor/`.
4. Tras el login, redirigir al inicio del rol. Si un usuario entra a un segmento de otro rol, redirigirlo al suyo (es navegación, no seguridad: la seguridad la da la API).
5. `AppShell`, `header.tsx` (logo, usuario, botón "Cerrar sesión") y un sidebar por rol en `components/layout/`. El layout raíz sólo monta `<Providers>`.
   - Mesa de entradas: Alumnos, Profesores, Materias, Turnos, Agenda diaria.
   - Profesor: Mi agenda, Mis alumnos.
   - Las pantallas de HU aún no implementadas quedan como páginas con su título.
6. Manejo centralizado del 401 en `providers.tsx` (`onError` de `QueryCache` y `MutationCache`): redirige a `/login` con el aviso "Tu sesión expiró". En el mismo lugar, el 403 `USUARIO_INHABILITADO` (usuario dado de baja con la sesión abierta) cierra la sesión y lleva a `/login` con "Su usuario no está habilitado"; el resto de los 403 (`SIN_PERMISO`) los maneja cada componente.
7. Actualizar el tipo `Role` de `src/types/index.ts` a los valores del contrato y `arquitectura-frontend.md` (Roles; ya no hay route groups de rol).

**Criterios de aceptación**

- Cada usuario del seed ve sólo el menú de su rol.
- Cerrar sesión lleva a `/login` y el botón Atrás no permite volver a una pantalla con datos.
- Con la sesión vencida, cualquier acción redirige al login con el aviso.

---

## T-05 · [Back] HU-01 · API de alumnos: listado con búsqueda, detalle, alta y edición

- **HU:** HU-01 Gestión de datos del alumno
- **Área:** Backend
- **Rama:** `feat/alumnos-api`
- **Depende de:** T-01, T-02, T-03

**Descripción**
Completar la feature `src/server/features/alumnos/`, que hoy es el esqueleto modelo, con los endpoints de mesa de entradas. Todos requieren rol `MESA_ENTRADAS`. Los datos de examen no forman parte de esta tarea: se tratan con HU-08.

**Alcance**

1. `GET /api/v1/alumnos`: paginado, orden por apellido (con `id` como desempate), `q` con `contains` sobre `busqueda`. Cada ítem trae id, apellido y nombre. Sin filtro de estado.
2. `GET /api/v1/alumnos/{id}`: detalle con datos identificatorios, de contacto, del tutor, escolares, observaciones y auditoría (quién creó y quién modificó por última vez, con fecha y hora). Exámenes (HU-08) y turnos (HU-07) se suman cuando se implementen esas HU.
3. `POST /api/v1/alumnos` y `PATCH /api/v1/alumnos/{id}`, con las primitivas de `shared/zod`:
   - Obligatorios: nombre, apellido, DNI, fecha de nacimiento, email y teléfono (decisión T-25).
   - Opcionales: nivel de escolaridad, grado o año, colegio, observaciones y datos del tutor.
   - Si es menor de edad, son obligatorios nombre, apellido, teléfono y email del tutor. La edad la calcula el service con `hoy()` (reloj inyectable) y devuelve 400 `VALIDACION` con el detalle por campo.
4. `busqueda` se recalcula en cada alta y edición.
5. DNI único: el repository traduce `P2002` a 409 `CONFLICTO`, en el alta y en la edición.
6. Auditoría completada por el repository con el `Actor`.
7. Swagger con ejemplos.

**Criterios de aceptación**

- `q=gonz` devuelve a "González"; `q=GONZALEZ` también.
- Alta de un menor sin datos del tutor → 400 con los campos marcados.
- Alta o edición con DNI repetido → 409.
- Tests del service: menor de edad con reloj fijo (incluido el día exacto en que cumple 18), DNI duplicado en alta y en edición, alumno inexistente → 404.

---

## T-06 · [Front] HU-01 · Pantallas de alumnos: listado, buscador, detalle, alta y edición

- **HU:** HU-01 Gestión de datos del alumno
- **Área:** Frontend
- **Rama:** `feat/alumnos-ui`
- **Depende de:** T-04, T-05 (puede empezar en paralelo)

**Descripción**
Completar `src/features/alumnos/` (feature modelo del frontend) y sus páginas en `app/mesa/alumnos/`. Los datos de examen quedan para HU-08.

**Alcance**

1. Listado paginado con apellido y nombre.
2. Buscador por DNI, nombre o apellido con `use-debounce`. Sin coincidencias: aviso y botón para dar de alta un alumno.
3. El buscador se arma como componente reutilizable de la feature, expuesto mediante su hook, porque lo usa la pantalla de registrar turno (HU-07).
4. Botón "+ Nuevo alumno" y formulario de alta y edición en secciones: identificatorios, contacto, tutor, escolares y observaciones.
   - El schema del frontend valida sólo formato (DNI, email, teléfono, fecha `YYYY-MM-DD`) y marca como obligatorios solo nombre, apellido, DNI, fecha de nacimiento, email y teléfono (decisión T-25). Los del tutor se marcan cuando la API responde 400.
   - Si el alumno es menor y faltan los datos del tutor, la API responde 400 y el formulario marca esos campos. La edad no se calcula en el cliente.
   - Un 409 por DNI repetido se muestra sobre el campo DNI.
5. Detalle con todos los datos, auditoría formateada en hora local y botón "Editar". Secciones "Exámenes" y "Turnos" visibles como "Próximamente".
6. Fechas siempre como string `YYYY-MM-DD` y formateadas con `date-fns` (nunca `new Date('YYYY-MM-DD')`).
7. Las mutaciones invalidan las keys de la feature, para que el alumno aparezca en el listado de inmediato.

**Criterios de aceptación**

- Recorrido completo: buscar, no encontrar, dar de alta desde el aviso, verlo en el listado y editarlo.
- Un menor sin tutor no se guarda y los campos del tutor quedan marcados.
- La fecha de nacimiento se muestra igual a la cargada (sin corrimiento de un día).

---

## T-07 · [Back] HU-02 · API de profesores: listado con filtros, detalle, alta con cuenta, edición y foto

- **HU:** HU-02 Gestión de datos personales del profesor
- **Área:** Backend
- **Rama:** `feat/profesores-api`
- **Depende de:** T-01, T-02, T-03

**Descripción**
Crear la feature `src/server/features/profesores/` con `/nueva-feature-api profesores`. El alta crea al profesor junto con su cuenta de usuario (rol `PROFESOR`), con la contraseña inicial que define mesa de entradas. Todos los endpoints requieren rol `MESA_ENTRADAS`.

**Alcance**

1. `GET /api/v1/profesores`: paginado, orden por apellido. Filtros `estado` (por defecto `ACTIVO`) y `materiaId`, y búsqueda `q` sobre `busqueda`, combinables. Cada ítem trae id, apellido, nombre, estado y URL prefirmada de la foto (si tiene).
   - La HU pide la opción "Todos", que el contrato hoy no contempla. Se agrega el valor `TODOS` al filtro `estado` y se actualiza `contrato-api.md` en este PR.
   - El filtro por materia considera las asignaciones activas de `AsignacionMateria`. Devuelve resultados una vez que T-11 permite asignar materias.
2. `GET /api/v1/profesores/{id}`: todos los datos, estado y auditoría (la de su `Usuario`). Materias asignadas (HU-04) y horario de atención (HU-05) se suman al implementar esas HU.
3. `POST /api/v1/profesores`:
   - Obligatorios: nombre, apellido, DNI, teléfono, email, título, matrícula y contraseña inicial, de entre `LARGO_MINIMO_PASSWORD` (8) y `LARGO_MAXIMO_PASSWORD` (128) caracteres: se validan con esas constantes de `src/lib/auth-reglas.ts`, las mismas que usa Better Auth, no con números propios.
   - En una sola transacción del repository crea `Usuario` (rol `PROFESOR`), su cuenta de tipo credencial (`providerId: 'credential'`, `accountId` = id del usuario) con la contraseña hasheada por `hashPassword()` de `src/lib/auth.ts` (T-03) y `Profesor` en estado `ACTIVO`. Si algo falla, no queda nada creado. Nunca `auth.api.signUpEmail` (bloqueado) ni un hash a mano. Referencia: `prisma/seed.ts` y `arquitectura-backend.md` → Cambios frecuentes.
   - La contraseña nunca se devuelve ni se registra en logs.
4. `PATCH /api/v1/profesores/{id}`: mismas validaciones, salvo la contraseña, que no se edita (la administración de usuarios está fuera de alcance). Como el email es el de la cuenta, cambiarlo cambia el email de ingreso.
5. Unicidad: DNI y matrícula entre todos los profesores (activos e inactivos) y email entre todos los usuarios → 409 `CONFLICTO` con un mensaje que indique qué dato está repetido.
6. Foto por multipart a la API (JPG o PNG, con tamaño máximo), a través de `src/lib/storage.ts`, en el bucket existente. En la base se guarda la clave, no la URL. Endpoints para subir o reemplazar y para quitar. Al reemplazar o quitar se borra el objeto anterior.
7. `busqueda` recalculada en cada alta y edición.

**Criterios de aceptación**

- Un profesor dado de alta puede iniciar sesión con su email y la contraseña inicial.
- Si falla la creación del profesor, tampoco queda la cuenta.
- DNI, matrícula o email repetidos → 409.
- Un archivo que no es JPG ni PNG → 400.
- El listado por defecto muestra sólo activos, y `estado=TODOS` muestra todos.
- Tests del service: alta completa, cada conflicto de unicidad, profesor inexistente → 404, validación de la foto.

---

## T-08 · [Front] HU-02 · Pantallas de profesores: listado con filtros, detalle, alta y edición

- **HU:** HU-02 Gestión de datos personales del profesor
- **Área:** Frontend
- **Rama:** `feat/profesores-ui`
- **Depende de:** T-04, T-07, T-09 (selector de materias) (puede empezar en paralelo)

**Descripción**
Crear `src/features/profesores/` con `/nueva-feature-ui profesores profesor` y sus páginas en `app/mesa/profesores/`.

**Alcance**

1. Listado paginado con foto (o avatar genérico), apellido y nombre. Con el filtro "Todos", los inactivos llevan la etiqueta "Inactivo".
2. Filtros de estado (Activos por defecto, Inactivos, Todos) y de materia, más el buscador, combinables. El filtro de materia usa el hook de `features/materias` (selector de materias activas). Aviso cuando no hay coincidencias.
3. Botón "+ Nuevo profesor". Formulario de alta con todos los datos, contraseña inicial y su confirmación (ambas enmascaradas). El schema del formulario pide entre 8 y 128 caracteres, el mismo rango que valida la API (T-07); si la API responde 400, se marca el campo. La edición no muestra la contraseña.
4. Errores 400 por campo y 409 (DNI, matrícula o email repetidos) mostrados sobre el campo correspondiente.
5. Foto con vista previa, y opciones de reemplazar o quitar desde la edición.
6. Detalle con todos los datos, estado, auditoría y botón "Editar". Sección "Materias" vacía, que completa T-12, y "Horario de atención" como "Próximamente" (HU-05).

**Criterios de aceptación**

- Recorrido completo: alta con foto y contraseña, cerrar sesión e ingresar como ese profesor, volver como mesa de entradas, editar reemplazando la foto y quitarla.
- Filtros y búsqueda funcionan combinados.

---

## T-09 · [Back] HU-03 · API del catálogo de materias: listado, selector, detalle, alta, edición y baja lógica

- **HU:** HU-03 Gestión del catálogo de materias
- **Área:** Backend
- **Rama:** `feat/materias-api`
- **Depende de:** T-01, T-02, T-03

**Descripción**
Crear la feature `src/server/features/materias/` con `/nueva-feature-api materias`. Todos los endpoints requieren rol `MESA_ENTRADAS`.

**Alcance**

1. `GET /api/v1/materias`: paginado, orden por nombre, `estado` (por defecto `ACTIVO`; admite `TODOS`, ver T-07) y `q` sobre `busqueda`.
2. Selector de materias activas sin paginar (un arreglo con id y nombre), para el filtro de profesores y, más adelante, para asignaciones (HU-04) y turnos (HU-07). Se documenta su ruta en `contrato-api.md`.
3. `GET /api/v1/materias/{id}`: nombre, descripción, estado, auditoría y profesores que la dictan (id, apellido, nombre y estado), a partir de las asignaciones activas. `AsignacionMateria` pertenece a la feature `profesores`: la lectura se hace importando `profesores.repository` (única dependencia permitida entre features).
4. `POST /api/v1/materias` y `PATCH /api/v1/materias/{id}`: nombre obligatorio y descripción opcional. `busqueda` se recalcula al guardar. Un nombre repetido (sin distinguir mayúsculas ni tildes) llega como `P2002` y se traduce a 409 `CONFLICTO`.
5. Baja lógica (`estado = INACTIVO`). Si la materia tiene asignaciones activas, 409 con el código específico `MATERIA_CON_PROFESORES` y los profesores en `details`. El código se agrega a `contrato-api.md`.
6. El repository expone la lectura de materias activas para que la importen otras features.

**Criterios de aceptación**

- "Matemática" y "matematica" no pueden coexistir.
- Una materia dada de baja no aparece en el listado por defecto ni en el selector, pero sí con `estado=INACTIVO`.
- La baja con asignaciones activas devuelve 409 `MATERIA_CON_PROFESORES` con los profesores.
- Tests del service: nombre duplicado, baja con y sin asignaciones, materia inexistente → 404.

---

## T-10 · [Front] HU-03 · Pantallas del catálogo de materias

- **HU:** HU-03 Gestión del catálogo de materias
- **Área:** Frontend
- **Rama:** `feat/materias-ui`
- **Depende de:** T-04, T-09 (puede empezar en paralelo)

**Descripción**
Crear `src/features/materias/` con `/nueva-feature-ui materias materia` y sus páginas en `app/mesa/materias/`. La feature expone además el hook del selector de materias activas que usa profesores.

**Alcance**

1. Listado paginado con filtro de estado (Activas por defecto, Inactivas, Todas) y buscador por nombre, combinables.
2. Botón "+ Nueva materia" y formulario de alta y edición (nombre obligatorio, descripción opcional). Un 409 por nombre repetido se muestra sobre el campo.
3. Detalle con nombre, descripción, estado, auditoría y la lista de sólo lectura de profesores que la dictan, cada uno con enlace a su ficha.
4. Botón "Dar de baja" con confirmación. Ante `MATERIA_CON_PROFESORES`, mostrar cuántos y cuáles son, con enlace a la ficha de cada uno, usando `details`.
5. Hook `use-materias-activas` para el selector.

**Criterios de aceptación**

- Recorrido completo: alta, edición, baja y verla con el filtro "Inactivas".
- El rechazo de la baja muestra los profesores con sus enlaces.

---

## T-11 · [Back] HU-04 · API de materias asignadas al profesor: asignar, listar y quitar

- **HU:** HU-04 Gestión de materias asignadas al profesor
- **Área:** Backend
- **Rama:** `feat/profesores-materias-api`
- **Depende de:** T-07, T-09

**Descripción**
Agregar a la feature `profesores` la gestión de sus materias asignadas (`arquitectura-backend.md`: `profesores` incluye materias asignadas). Todos los endpoints requieren rol `MESA_ENTRADAS`. Incluye construir la consulta única de "turno vigente" en `turnos.repository`, que esta HU es la primera en necesitar.

**Alcance**

1. `GET /api/v1/profesores/{id}/materias`: materias con asignación activa del profesor (id y nombre), sin paginar.
2. `POST /api/v1/profesores/{id}/materias` con `materiaIds` (una o varias), en una sola transacción: se asignan todas o ninguna.
   - El profesor debe estar `ACTIVO`: si no, 409 `PROFESOR_INACTIVO`.
   - Cada materia debe existir y estar `ACTIVA` (lectura por `materias.repository`): si no, 404 o 409 `MATERIA_INACTIVA`.
   - Una materia ya asignada y activa → 409 `CONFLICTO`.
   - Si existe una asignación previa en estado `INACTIVO` para ese par profesor–materia, se reactiva en lugar de insertar una fila nueva (el par es único y la baja es lógica).
3. `DELETE /api/v1/profesores/{id}/materias` con `materiaIds` (una o varias, igual que el alta), en una sola operación: se quitan todas o ninguna. Baja lógica de la asignación (`estado = INACTIVO`), nunca borrado físico.
   - Si el profesor tiene turnos vigentes de esa materia, 409 `TURNOS_VIGENTES` y no se quita. En `details` va la cantidad de turnos.
4. Turno vigente (`dominio.md` → Turnos; `convenciones-backend.md` → Turno vigente):
   - Crear el esqueleto de `turnos` con `/nueva-feature-api turnos` e implementar en `turnos.repository` **sólo** la consulta de turnos vigentes filtrable por profesor y materia: recurrentes sin fecha de fin o con fin >= hoy, y sesiones únicas con fecha >= hoy.
   - La fecha de hoy la recibe por parámetro: el service la obtiene con `hoy()` y reloj inyectable.
   - Es la única implementación de esa condición: la reutilizan HU-03 a HU-06 y turnos (HU-07). Avisar a quien tome HU-07 que el esqueleto ya existe.
5. Exponer en `profesores.repository` las lecturas que consumen otras features: asignaciones activas por materia (detalle y baja de materias, T-09) y profesores activos que dictan una materia (para registrar turnos, HU-07).
6. Auditoría de la asignación completada con el `Actor`.
7. Actualizar `contrato-api.md` (códigos `PROFESOR_INACTIVO`, `MATERIA_INACTIVA` y `TURNOS_VIGENTES`) y la tabla Estado de `convenciones-backend.md` (consulta de turno vigente construida).

**Criterios de aceptación**

- Asignar varias materias a un profesor activo las muestra en su ficha y el profesor aparece en el detalle de cada materia.
- No se puede asignar a un profesor inactivo ni una materia inactiva.
- Quitar y volver a asignar una materia reactiva la misma asignación.
- Con un turno vigente de esa materia (cargado a mano en la base para la prueba), la baja responde 409 `TURNOS_VIGENTES`.
- Tests del service con reloj fijo: asignación múltiple, profesor inactivo, materia inactiva, materia ya asignada, reactivación, baja con y sin turnos vigentes (incluido un recurrente cuya fecha de fin es exactamente hoy).

---

## T-12 · [Front] HU-04 · Sección "Materias" en la ficha del profesor

- **HU:** HU-04 Gestión de materias asignadas al profesor
- **Área:** Frontend
- **Rama:** `feat/profesores-materias-ui`
- **Depende de:** T-08, T-10, T-11 (puede empezar en paralelo)

**Descripción**
Completar en `src/features/profesores/` la sección "Materias" del detalle del profesor, para asignar y quitar materias.

**Alcance**

1. Sección "Materias" en la ficha del profesor con sus materias asignadas.
2. Botón "+ Asignar materia", que abre un selector con las materias activas (hook `use-materias-activas` de `features/materias`) sin las ya asignadas, con selección de una o varias.
3. Si el profesor está inactivo, el botón no se muestra y se indica el motivo. Es sólo ayuda visual: si la API responde `PROFESOR_INACTIVO`, se muestra su `message`.
4. "Quitar" en cada materia, con confirmación. Ante `TURNOS_VIGENTES`, mostrar que no se puede quitar porque el profesor tiene turnos vigentes de esa materia (la cantidad sale de `details`).
5. Tras asignar o quitar, invalidar las keys de profesores y el detalle de materias. Como de otra feature sólo se usan sus hooks, `features/materias` expone un hook para invalidar su detalle.

**Criterios de aceptación**

- Recorrido completo: asignar dos materias, ver al profesor en el detalle de ambas, quitar una y ver que desaparece de ese detalle.
- La materia quitada vuelve a estar disponible en el selector.
- Un profesor inactivo no ofrece la opción de asignar.

---

## T-13 · [Front] Sistema de diseño: paleta de colores, tokens y primitivos de UI

- **HU:** Transversal (habilita todas las pantallas del frontend)
- **Área:** Frontend
- **Rama:** `feat/ui-primitivos`
- **Prioridad:** No bloqueante, pero conviene mergearla antes que T-06, T-08 y T-10 empiecen a construir sus tablas y formularios, para que nazcan con los primitivos en lugar de reescribirlos después

**Descripción**
Resolver la decisión D-08 (ahora T-25 en `decisiones.md`: shadcn/ui sobre Radix) y construir la base visual que reutilizan todas las features: la paleta de marca (Figma), los tokens de color de Tailwind y los primitivos de `components/ui/`. **No incluye** tocar `/login`: lo está trabajando Alvaro y se re-skinnea en un PR aparte, chico, una vez mergeada esta tarea.

**Alcance**

1. Instalar shadcn/ui con su CLI (copia el código a `components/ui/`, no queda como dependencia opaca). Agregar a `docs/dependencias.md`, en el mismo PR, cada paquete que suma el CLI (`class-variance-authority`, `@radix-ui/react-*` por primitivo instalado) — acordado con el equipo (`AGENTS.md`, regla 8).
2. Tokens de color en `src/app/globals.css` con `@theme` (Tailwind v4), a partir de la paleta de marca:
   - Página: `cobalto` `#3552CC` (marca y foco), `blanco` `#FFFFFF` (superficies), `tinta` `#20241F` (texto), `piedra` `#C5BEAA` (neutro cálido), `dorado` `#DDAF69` (acentos), `oscuro` `#777C92` (interfaz), `luminoso` `#E0E1E4` (fondo claro).
   - Acciones: `confirmado` `#2C5540` (éxito), `cancelado` `#6F1F2A` (error), `urgente` `#B5852C` (prioridad), `pendiente` `#2E5069` (información).
   - Sacar el boilerplate de modo oscuro de `create-next-app`: el Figma no define una variante oscura; si hace falta más adelante, se decide aparte.
3. Primitivos en `components/ui/` con la API de shadcn, estilados con los tokens nuevos (no con los colores por defecto de shadcn): `Button`, `Input`, `Badge`, `Avatar`, `Card`, `Table`, `Select`, `Dialog`, `Pagination`.
4. Re-skin de `components/layout/{app-shell,header,mesa-sidebar,profesor-sidebar}.tsx` con los tokens (sidebar oscuro con ítem activo, según el Figma).
5. Actualizar `docs/arquitectura-frontend.md` → "Estilos y UI" con la lista final de primitivos, los nombres de los tokens y la referencia a T-25 en lugar de D-08.

**Criterios de aceptación**

- `pnpm check` pasa.
- `/mesa/alumnos` y `/profesor` se ven con la paleta nueva (Header, Sidebar, botones, tabla) sin que cambie ningún comportamiento existente.
- `/login` sigue exactamente igual (queda para el PR de Alvaro).

---

## T-14 · [Back] FIX · Modelo de datos: aulas, capacidad del profesor y turnos por hora

- **HU:** Transversal (corrige T-01; habilita HU-05, HU-06 y HU-07)
- **Área:** Backend
- **Rama:** `fix/modelo-aulas-capacidad`
- **Depende de:** T-01 (mergeada)
- **Prioridad:** Bloqueante para T-15, T-17 y T-21; se mergea antes que cualquiera de ellas

**Descripción**
El Product Backlog v4 cambió tres cosas del modelo que T-01 no contemplaba, y que hoy hacen imposible implementar HU-05 y HU-07 como están escritas. Esta tarea **no reemplaza a T-01**: la corrige, con el mismo criterio (todo el DER de una vez, para que nadie más toque el modelo base durante el sprint).

Los tres cambios: las aulas no existen como entidad, la capacidad pasó del bloque al profesor, y un turno ahora ocupa **una hora** de un bloque y no el bloque entero.

**Alcance**

1. **`Aula` (entidad nueva):** `id`, `nombre` (único), `capacidad` (entero > 0), `estado` y auditoría. Las aulas se precargan por seed y **no tienen ABM en este release** (HU-05): no se crea feature de escritura, sólo lectura.
2. **`Profesor.capacidad`:** entero >= 1, obligatorio. Es la cantidad máxima de alumnos que el profesor atiende a la vez en una misma hora (HU-02).
3. **`BloqueAgenda`:** se agrega `aulaId` (FK obligatoria a `Aula`) y **se quita `capacidad`**. La capacidad efectiva de cada hora es `min(profesor.capacidad, aula.capacidad)` y **no se persiste**: se calcula al leer, igual que las ocurrencias de un recurrente. Índice en `aulaId` y en `(aulaId, diaSemana)`.
4. **`Turno.horaInicio`:** entero, minutos desde medianoche, obligatorio. Un turno ocupa **una hora** del bloque: un bloque de 8:00 a 12:00 tiene cuatro horas y cada una se reserva por separado (HU-07). Índice `(bloqueAgendaId, horaInicio, fechaInicio)`.
5. **Restricciones `CHECK`** para el `migration.sql` (Prisma no las genera). Las nuevas y las que cambian:
   - `aula`: `capacidad > 0`.
   - `profesor`: `capacidad >= 1`.
   - `bloque_agenda`: se quita el check de `capacidad`; se agregan `hora_inicio % 60 = 0`, `hora_fin % 60 = 0` y `hora_fin - hora_inicio >= 60` (horas en punto y duración mínima de una hora, HU-05). Se mantienen los de día y orden de horas.
   - `turno`: `hora_inicio BETWEEN 0 AND 1439` y `hora_inicio % 60 = 0`. Que la hora caiga **dentro** del bloque no se puede expresar con un `CHECK` (es otra tabla): lo valida la API.
6. **Seed:** aulas de ejemplo con nombre y capacidad distintas entre sí (para que se vea el efecto de `min(...)` al probar), y `capacidad` en el profesor del seed. Sigue siendo idempotente (`upsert` por clave natural).
7. **Migración sobre base con datos:** las tres columnas nuevas son NOT NULL sobre tablas que ya existen. La migración necesita un default temporal (y quitarlo después) o una base limpia. Coordinarlo con quien lleve el modelo de datos antes de generarla.
8. **`ExamenMateria` no se toca:** queda en el schema, sin uso en este sprint. Los exámenes y la prioridad pasan al Sprint 2 con HU-08.
9. **Documentación (mismo PR, regla 9):**
   - `docs/dominio.md`: sección nueva de **Bloques de clase** (horas en punto, duración mínima, sin superposición, aula asignada, capacidad efectiva) y actualización de **Turnos** (el turno ocupa una hora del bloque) y de **Profesores** (capacidad).
   - `docs/decisiones.md`: pasan a **Tomadas** la capacidad efectiva derivada (no persistida), el turno por hora, y **D-04**, que el backlog v4 resuelve: al registrar un recurrente con fechas llenas, el sistema ofrece "Asignar igual" y esas fechas se guardan como excepciones (HU-07).
   - `docs/contrato-api.md`: los formatos nuevos que vea el frontend (capacidad, aula, hora del turno).
10. La migración la genera y la aplica **la persona** con `pnpm db:migrate`, no un agente de IA (`AGENTS.md`, regla 10).

**Criterios de aceptación**

- Con la base migrada y el seed corrido, existen las aulas de ejemplo y el profesor del seed tiene capacidad.
- Un bloque no se puede guardar sin aula, con horas que no sean en punto, ni con una duración menor a una hora (falla a nivel de base).
- Un turno no se puede guardar sin hora de inicio.
- `BloqueAgenda` ya no tiene columna `capacidad`.
- Correr el seed dos veces no duplica aulas ni falla.

---

## T-15 · [Back] FIX · HU-02 · Capacidad del profesor en la API de profesores

- **HU:** HU-02 Gestión de datos personales del profesor
- **Área:** Backend
- **Rama:** `fix/profesores-capacidad-api`
- **Depende de:** T-14, T-07 (mergeada)

**Descripción**
El backlog v4 sumó `capacidad` a los datos obligatorios del profesor, con una regla propia al editarla. T-07 ya está mergeada sin ese campo: esta tarea lo agrega a la feature existente, sin rehacer lo demás.

**Alcance**

1. `capacidad` obligatoria en `POST /api/v1/profesores` y en `PATCH /api/v1/profesores/{id}`: entero >= 1. Si hace falta una primitiva de entero positivo, se agrega a `@/server/shared/zod` y no dentro de la feature (`AGENTS.md`, regla 6).
2. `capacidad` en la respuesta del detalle (`GET /api/v1/profesores/{id}`). En el listado no hace falta: el listado sigue mostrando foto, apellido, nombre y estado.
3. **Regla nueva al editar:** la capacidad no puede bajarse por debajo de la cantidad de turnos vigentes que el profesor ya tenga en alguna hora de sus bloques. Si no se cumple → 409 con el código nuevo **`CAPACIDAD_INSUFICIENTE`**, y en `details` la hora conflictiva (bloque, día, hora y cantidad de turnos vigentes), para que la UI pueda decir exactamente dónde está el problema.
   - El conteo de turnos vigentes sale de `turnos.repository` (la condición única de "turno vigente" de T-11): **no se reescribe la condición acá**.
   - La fecha de hoy la obtiene el service con `hoy()` y reloj inyectable.
4. Agregar `CAPACIDAD_INSUFICIENTE` a la tabla de códigos específicos de `docs/contrato-api.md` en el mismo PR.
5. Tests del service: alta con capacidad válida, capacidad inválida (0 o negativa), y bajada de capacidad con y sin turnos vigentes en alguna hora (con reloj fijo).

**Criterios de aceptación**

- Un alta sin capacidad responde 400 con el campo marcado.
- Bajar la capacidad de un profesor con más turnos vigentes en alguna hora responde 409 `CAPACIDAD_INSUFICIENTE` e indica cuál es esa hora.
- Subir la capacidad, o bajarla a un valor que sigue alcanzando, funciona.

---

## T-16 · [Front] FIX · HU-02 · Capacidad del profesor en las pantallas de profesores

- **HU:** HU-02 Gestión de datos personales del profesor
- **Área:** Frontend
- **Rama:** `fix/profesores-capacidad-ui`
- **Depende de:** T-15, T-08 (puede empezar en paralelo)

**Descripción**
Reflejar en `src/features/profesores/` el campo `capacidad` que agrega T-15.

**Alcance**

1. Campo "Capacidad" en el formulario de alta y de edición, con la ayuda de qué significa (cuántos alumnos atiende a la vez en una misma hora). El schema del frontend valida **sólo formato** (entero >= 1).
2. Capacidad visible en el detalle del profesor.
3. Manejo del 409 `CAPACIDAD_INSUFICIENTE`: se muestra sobre el campo Capacidad, usando el `message` y el `details` de la API (qué hora y cuántos turnos vigentes tiene). La regla **no se recalcula en el cliente**.
4. Actualizar el tipo de la entidad en `profesores.types.ts` según el contrato.

**Criterios de aceptación**

- No se puede guardar un profesor sin capacidad, y el campo queda marcado.
- Al intentar bajar la capacidad por debajo de lo ocupado, el formulario muestra el motivo con la hora concreta.

---

## T-17 · [Back] HU-05 · API del horario de atención: bloques de clase con aula y capacidad efectiva

- **HU:** HU-05 Gestión de horario de atención del profesor (bloques de clase)
- **Área:** Backend
- **Rama:** `feat/bloques-api`
- **Depende de:** T-14, T-11

**Descripción**
Agregar a la feature `profesores` la gestión de sus bloques de clase (`arquitectura-backend.md`: `profesores` incluye materias asignadas y bloques de clase), y la lectura del catálogo de aulas que el alta necesita. Todos los endpoints requieren rol `MESA_ENTRADAS`.

**Alcance**

1. `GET /api/v1/profesores/{id}/bloques`: los bloques activos del profesor, ordenados por día y hora, sin paginar (es un horario semanal). Cada bloque trae día, hora de inicio y fin, aula (id y nombre), y **una entrada por cada hora** del bloque con su capacidad efectiva y su ocupación (turnos vigentes / capacidad efectiva).
   - Capacidad efectiva = `min(profesor.capacidad, aula.capacidad)`, calculada al leer.
   - La ocupación sale de los turnos vigentes de esa hora, usando la condición única de `turnos.repository` (T-11).
2. Feature de API `aulas` con `/nueva-feature-api aulas`, sólo de lectura (las aulas no tienen ABM, HU-05):
   - `GET /api/v1/aulas/disponibles?diaSemana&horaInicio&horaFin&excluirBloqueId?`: las aulas libres **durante todo** ese horario ese día de la semana. Devuelve un arreglo (es un selector, no se pagina).
   - La ocupación de un aula se calcula sobre `bloque_agenda`, que pertenece a `profesores`: se lee importando `profesores.repository` (única dependencia permitida entre features). `excluirBloqueId` sirve para la edición, para que el bloque no se choque consigo mismo.
3. `POST /api/v1/profesores/{id}/bloques`: día de la semana, hora de inicio, hora de fin y aula, todos obligatorios. Validaciones, en este orden:
   - Horas **en punto** y duración mínima de una hora, con la hora de fin posterior a la de inicio (400).
   - El profesor debe estar `ACTIVO` → 409 `PROFESOR_INACTIVO`.
   - El profesor debe tener **al menos una materia asignada** activa (HU-05) → 409 con el código nuevo **`PROFESOR_SIN_MATERIAS`**.
   - El bloque no puede superponerse con otro bloque activo del mismo profesor ese día → 409 con el código nuevo **`BLOQUE_SUPERPUESTO`**, con el bloque en conflicto en `details`.
   - El aula debe estar libre todo el horario ese día → si la elegida no lo está, 409 con el código nuevo **`AULA_OCUPADA`**. Si **no hay ninguna** aula libre, el mensaje es exactamente el de la HU: "No hay un aula disponible en ese horario. Por favor, elija otro horario."
4. `PATCH /api/v1/profesores/{id}/bloques/{bloqueId}`: día, horario y aula, con las mismas validaciones del alta. Sólo si el bloque **no tiene turnos vigentes** → si los tiene, 409 `TURNOS_VIGENTES` con la cantidad en `details`.
5. `DELETE /api/v1/profesores/{id}/bloques/{bloqueId}`: **baja lógica** (`estado = INACTIVO`), nunca borrado físico. Sólo si no tiene turnos vigentes → si los tiene, 409 `TURNOS_VIGENTES`.
6. **Concurrencia:** la verificación de aula libre y la inserción del bloque van en una sola transacción del repository, para que dos altas simultáneas no se lleven la misma aula. Debe existir un test que cubra ese caso.
7. Exponer en `profesores.repository` las lecturas que consumen otras features: los bloques de un profesor y los bloques que solapan un horario (las usan `aulas` acá y `turnos` en T-21).
8. Agregar `PROFESOR_SIN_MATERIAS`, `BLOQUE_SUPERPUESTO` y `AULA_OCUPADA` a `docs/contrato-api.md`, y las reglas de bloques a `docs/dominio.md`, en el mismo PR.

**Criterios de aceptación**

- Un bloque de 8:00 a 12:00 se carga como **un** bloque y la lectura devuelve sus cuatro horas con su ocupación.
- Un profesor con capacidad 12 en un aula de 10 da capacidad efectiva 10 en cada hora; con capacidad 6 en la misma aula, 6.
- No se puede cargar un bloque a un profesor inactivo, ni a uno sin materias asignadas.
- Dos bloques del mismo profesor que se superponen el mismo día se rechazan; dos bloques del mismo día que no se superponen (8:00–12:00 y 16:00–18:00) se aceptan.
- Un aula ya asignada a un bloque que se superpone ese día no aparece entre las disponibles y se rechaza si se la manda igual.
- Editar o eliminar un bloque con turnos vigentes responde 409 `TURNOS_VIGENTES`.
- Tests del service con reloj fijo: alta feliz, cada validación, y dos altas simultáneas sobre la misma aula.

---

## T-18 · [Front] HU-05 · Sección "Horario" en la ficha del profesor

- **HU:** HU-05 Gestión de horario de atención del profesor (bloques de clase)
- **Área:** Frontend
- **Rama:** `feat/bloques-ui`
- **Depende de:** T-17, T-08 (puede empezar en paralelo)

**Descripción**
Completar en `src/features/profesores/` la sección "Horario" del detalle del profesor, para cargar, editar y eliminar bloques de clase.

**Alcance**

1. Sección "Horario" en la ficha del profesor con sus bloques **ordenados por día y hora**, cada uno con su aula y, por cada hora, la ocupación (turnos vigentes / capacidad efectiva).
2. Botón "+ Nuevo bloque" con día de la semana, hora de inicio, hora de fin y aula.
   - Los selectores de hora ofrecen **sólo horas en punto**.
   - El selector de aula se completa con `GET /api/v1/aulas/disponibles` para el día y horario elegidos, y se vuelve a pedir cuando cambian. Muestra el nombre y la capacidad de cada aula.
   - Si la API responde que no hay aulas disponibles, se muestra su `message` ("No hay un aula disponible en ese horario. Por favor, elija otro horario.") y no se permite guardar.
3. Editar un bloque con el mismo formulario, precargado. Eliminar con confirmación.
4. Errores 409 mostrados con su `message` y su `details`: `TURNOS_VIGENTES` (no se puede editar ni eliminar), `BLOQUE_SUPERPUESTO`, `AULA_OCUPADA`, `PROFESOR_INACTIVO` y `PROFESOR_SIN_MATERIAS`.
5. Si el profesor está inactivo o no tiene materias asignadas, el botón "+ Nuevo bloque" no se muestra y se indica el motivo. Es sólo ayuda visual: la regla la decide la API.
6. Tras cargar, editar o eliminar un bloque, invalidar las keys de la feature para que la sección se refresque.

**Criterios de aceptación**

- Recorrido completo: cargar un bloque de lunes de 8:00 a 12:00 eligiendo aula, verlo con sus cuatro horas y su ocupación en 0, editarlo y eliminarlo.
- Al elegir un día y horario donde todas las aulas están ocupadas, el formulario lo informa y no deja guardar.
- Un profesor sin materias asignadas no ofrece cargar bloques.

---

## T-19 · [Back] HU-06 · API de baja y reactivación lógica del profesor

- **HU:** HU-06 Baja y reactivación lógica del profesor
- **Área:** Backend
- **Rama:** `feat/profesores-baja-api`
- **Depende de:** T-07, T-11

**Descripción**
Agregar a la feature `profesores` la baja y la reactivación lógicas. La baja del profesor es la de su `Usuario` (decisión T-22): un profesor inactivo es un `Usuario` inactivo, que además no puede iniciar sesión (ya lo hace T-03). No depende de T-14: se puede hacer en paralelo.

**Alcance**

1. `PATCH /api/v1/profesores/{id}/baja` (misma forma que la baja de materias de T-09): pasa el `Usuario` del profesor a `INACTIVO`. Rol `MESA_ENTRADAS`.
2. `PATCH /api/v1/profesores/{id}/reactivacion`: lo vuelve a `ACTIVO`.
3. **No se permite la baja si el profesor tiene turnos vigentes** → 409 `TURNOS_VIGENTES`, y en `details` los turnos con alumno, materia, día y horario (lo que la HU pide mostrar). El conteo y la lista salen de `turnos.repository` (condición única de T-11); la fecha de hoy, de `hoy()` con reloj inyectable.
   - Ampliar `TURNOS_VIGENTES` en `docs/contrato-api.md`: hoy su `details` está descripto sólo para el caso de materias asignadas.
4. Dar de baja **no toca** materias asignadas, bloques ni el historial de turnos: se conservan tal cual.
5. Reactivar no revalida nada: el profesor vuelve a `ACTIVO` con sus materias y bloques intactos.
6. Las reglas que ya existen y que esta tarea sólo verifica que sigan valiendo: a un profesor inactivo no se le asignan materias (T-11) ni se le cargan bloques (T-17), y no aparece como opción al registrar un turno (T-21).
7. Actualizar `docs/dominio.md` → Profesores y materias con la reactivación (hoy sólo está la baja).

**Criterios de aceptación**

- Dar de baja a un profesor sin turnos vigentes lo deja `INACTIVO`, y deja de poder iniciar sesión.
- Dar de baja a un profesor con turnos vigentes responde 409 `TURNOS_VIGENTES` con la lista de esos turnos (alumno, materia, día y horario) y no cambia su estado.
- Un profesor inactivo con materias asignadas sigue figurando, con su estado, en el detalle de esas materias.
- Reactivar lo deja `ACTIVO` y vuelve a aparecer en el listado por defecto.
- Tests del service con reloj fijo: baja con y sin turnos vigentes (incluido un recurrente cuya fecha de fin es exactamente hoy), reactivación, y profesor inexistente → 404.

---

## T-20 · [Front] HU-06 · Baja y reactivación desde la ficha del profesor

- **HU:** HU-06 Baja y reactivación lógica del profesor
- **Área:** Frontend
- **Rama:** `feat/profesores-baja-ui`
- **Depende de:** T-19, T-08 (puede empezar en paralelo)

**Descripción**
Agregar a la ficha del profesor los botones de baja y reactivación, con la confirmación y el manejo del rechazo por turnos vigentes.

**Alcance**

1. Botón "Dar de baja" visible sólo si el profesor está activo, y "Reactivar" sólo si está inactivo. Los dos piden confirmación.
2. Ante `TURNOS_VIGENTES`, mostrar que no se puede dar de baja y **listar los turnos** que lo impiden (alumno, materia, día y horario) a partir de `details`.
3. El estado del profesor se muestra en la ficha y, en el listado con filtro "Todos", los inactivos llevan la etiqueta "Inactivo" (ya definido en T-08: verificar que siga funcionando).
4. Tras la baja o la reactivación, invalidar las keys del listado y del detalle de profesores para que el estado se refleje de inmediato.

**Criterios de aceptación**

- Recorrido completo: dar de baja un profesor sin turnos, verlo con el filtro "Inactivos", reactivarlo y verlo de nuevo en el listado por defecto.
- Con turnos vigentes, la baja se rechaza y la pantalla muestra cuáles son.

---

## T-21 · [Back] HU-07 · API de turnos: búsqueda de disponibilidad y registro por hora

- **HU:** HU-07 Registrar turno
- **Área:** Backend
- **Rama:** `feat/turnos-api`
- **Depende de:** T-14, T-17, T-05

**Descripción**
Completar la feature `src/server/features/turnos/`, que hoy sólo tiene la consulta de turnos vigentes (T-11), con la búsqueda de horarios disponibles y el registro de turnos. Un turno vincula un alumno con **una hora** de un bloque de un profesor. Todos los endpoints requieren rol `MESA_ENTRADAS`.

**La prioridad queda fuera de este sprint:** la prioridad y las fechas de examen pasan al Sprint 2 junto con HU-08. No se calcula, no se devuelve y no se agrega al contrato.

**Alcance**

1. `GET /api/v1/turnos/disponibilidad?materiaId&diaSemana?&profesorId?`: `materiaId` obligatorio, los otros dos opcionales y combinables (los cuatro casos de la HU). Devuelve un arreglo (no se pagina).
   - Sólo profesores **activos** con esa materia **asignada y activa** (se lee por `profesores.repository`) y sólo materias activas.
   - Cada resultado es un bloque con profesor, día, horario completo, aula, y **una entrada por hora** con su capacidad efectiva y su ocupación. Las horas llenas vienen igual, marcadas como tales: la UI las muestra con el aviso.
2. `POST /api/v1/turnos`: alumno, bloque, materia, **una o varias horas** del bloque, tipo (`RECURRENTE` con fecha de inicio y fin opcional, o `SESION_UNICA` con una fecha), motivo de consulta opcional, y una bandera para el "Asignar igual" de la HU.
   - **Una hora = un turno.** Todas las horas pedidas se registran en **una sola transacción**: se crean todas o ninguna.
   - Validaciones: el alumno existe (404); la materia está asignada al profesor del bloque (409); el profesor está activo (409 `PROFESOR_INACTIVO`); las horas están dentro del bloque, en punto y sin repetirse (400); las fechas coinciden con el día de la semana del bloque (400); en una `SESION_UNICA`, `fechaFin = fechaInicio` (decisión T-20).
   - **Alumno superpuesto:** un alumno no puede tener dos turnos que se pisen en fecha y horario → 409 con el código nuevo **`ALUMNO_SUPERPUESTO`**, con los turnos en conflicto en `details`.
   - **Capacidad:** se controla por cada hora seleccionada y por cada fecha en que aplica el turno, contra la capacidad efectiva de esa hora (`min` profesor/aula, T-17), contando recurrentes vigentes y sesiones únicas de esa fecha.
     - Si alguna hora está llena en alguna fecha → 409 `BLOQUE_LLENO`, con **la hora y las fechas** en `details` (hoy el código está descripto sólo con fechas: ampliar en `contrato-api.md`).
     - Con la bandera de "Asignar igual", en lugar de rechazar se registra el turno y esas fechas se guardan como `TurnoExcepcion`: en ellas el alumno no figura ni ocupa lugar (resuelve D-04, ver T-14).
     - Si una hora **no tiene lugar en ninguna** fecha, se rechaza siempre, aun con la bandera.
   - **Concurrencia:** la verificación de capacidad y la inserción van en una transacción que bloquea la fila del bloque (`SELECT ... FOR UPDATE`, `convenciones-backend.md` → Concurrencia). Debe existir un test de dos reservas simultáneas del último lugar.
3. `GET /api/v1/turnos/{id}`: alumno, profesor, materia, **aula**, día y hora, tipo, fechas, fechas exceptuadas, motivo de consulta, estado y auditoría (quién lo creó, con fecha y hora).
4. El estado del turno sigue siendo `ACTIVO` / `CANCELADO` en la base (decisión T-20). La HU lo llama "Agendado": es el texto que muestra la UI, no un valor nuevo del enum. Dejarlo dicho en `contrato-api.md` para que el frontend no lo invente.
5. Agregar `ALUMNO_SUPERPUESTO` a `docs/contrato-api.md` y actualizar `BLOQUE_LLENO`; actualizar `docs/dominio.md` → Turnos con la regla por hora y con la resolución de D-04.

**Criterios de aceptación**

- Buscar por materia sola devuelve todos los profesores que la dictan con sus días; agregando día y profesor, se filtra como pide la HU.
- Tildar dos horas no consecutivas de un bloque (8:00–9:00 y 10:00–11:00) crea **dos** turnos con la misma materia, tipo y fechas.
- Una sesión única en una hora completa se rechaza con `BLOQUE_LLENO`.
- Un recurrente con algunas fechas completas se rechaza con las fechas en `details`, y con "Asignar igual" se registra dejando esas fechas como excepciones.
- Un recurrente sin lugar en ninguna fecha se rechaza siempre.
- Un alumno con un turno el lunes de 9:00 a 10:00 no puede tomar otro que se pise.
- Tests del service con reloj fijo, con el repository mockeado: camino feliz de una y de varias horas, cada 4xx que lanza, y dos reservas simultáneas del último lugar.

---

## T-22 · [Front] HU-07 · Pantalla de registrar turno

- **HU:** HU-07 Registrar turno
- **Área:** Frontend
- **Rama:** `feat/turnos-ui`
- **Depende de:** T-21, T-06, T-10 (puede empezar en paralelo)

**Descripción**
Crear `src/features/turnos/` con `/nueva-feature-ui turnos turno` y la pantalla de registrar turno en `app/mesa/turnos/`.

**Alcance**

1. **Elegir alumno** con el buscador de `features/alumnos`, reutilizado por su hook (T-06 lo dejó como componente de la feature justamente para esto). Si no hay coincidencias, se ofrece dar de alta un alumno.
2. **Buscar horarios** con tres filtros: materia (obligatorio, con el hook `use-materias-activas` de `features/materias`), día de la semana y profesor, los dos últimos opcionales y combinables.
3. **Resultados:** cada bloque con profesor, día, horario completo ("de 8:00 a 12:00") y aula. Al seleccionar uno, se muestran sus horas con un checkbox y la ocupación de cada una; las horas llenas se muestran igual, con el aviso de que están completas, y no se pueden tildar.
4. **Tipo de turno:** "Recurrente" (fecha de inicio y fecha de fin opcional) o "Sesión única" (una fecha). El schema del frontend valida **sólo formato** (fechas `YYYY-MM-DD`); que la fecha caiga en el día del bloque, la capacidad y los solapamientos los decide la API.
5. Campo "motivo de consulta", texto libre opcional.
6. **Manejo de los rechazos**, con el `message` y el `details` de la API:
   - `BLOQUE_LLENO` en una sesión única: se informa y se ofrece "Buscar otros turnos disponibles".
   - `BLOQUE_LLENO` en un recurrente: se listan las fechas sin lugar (por ejemplo, "El lunes 12/10 la hora de 9:00 a 10:00 está completa") y se ofrecen "Asignar igual" y "Cancelar". "Asignar igual" reenvía el alta con la bandera; "Cancelar" vuelve a la búsqueda.
   - `ALUMNO_SUPERPUESTO`, `PROFESOR_INACTIVO` y los 400 por campo, mostrados donde corresponda.
7. La confirmación muestra el **aula** del bloque, y el detalle del turno muestra también las fechas exceptuadas.
8. Fechas siempre como string `YYYY-MM-DD`, formateadas con `date-fns`; nunca `new Date('YYYY-MM-DD')`.

**Criterios de aceptación**

- Recorrido completo: buscar un alumno, filtrar por materia, elegir un bloque, tildar dos horas, cargar un recurrente y verlo confirmado con su aula.
- Una hora completa se ve como completa y no se puede tildar.
- El recurrente con fechas llenas muestra cuáles son y permite "Asignar igual".
- La pantalla no calcula capacidad, prioridad, vigencia ni solapamientos.

---

## T-23 · [Back] HU-09 · API de la agenda diaria del centro

- **HU:** HU-09 Ver agenda diaria del centro
- **Área:** Backend
- **Rama:** `feat/agenda-diaria-api`
- **Depende de:** T-21

**Descripción**
Agregar a la feature `turnos` la lectura de la agenda de un día, con todos los profesores. Rol `MESA_ENTRADAS`.

**La prioridad no entra:** HU-09 la pide entre los datos del turno, pero depende de las fechas de examen (HU-08), que pasan al Sprint 2. La agenda no la devuelve ni la muestra en este sprint; se suma en el Sprint 2 junto con HU-08, y hasta entonces queda anotado en el issue, no en los docs.

**Alcance**

1. `GET /api/v1/turnos/agenda?fecha=YYYY-MM-DD&profesorId?`: devuelve un arreglo (la agenda diaria **no se pagina**, `convenciones-backend.md` → Paginación). Si no se manda `fecha`, la de hoy, que la decide la API con `hoy()`.
2. **Expansión de ocurrencias** (decisión T-20): se listan los turnos que aplican a esa fecha —recurrentes cuya regla la alcanza y sesiones únicas de ese día—, **excluyendo** las fechas exceptuadas (`TurnoExcepcion`) y los turnos `CANCELADO`.
   - Es la única implementación de la expansión: la reutiliza T-25 y cualquier vista futura, sin reescribirla.
3. Cada ítem: alumno (apellido y nombre), profesor (apellido y nombre), materia, aula, hora de inicio y fin, y estado. Ordenado por hora y, dentro de la hora, por profesor.
4. Filtro opcional por profesor.
5. Tests del service con reloj fijo: un recurrente vigente aparece en una fecha que le corresponde y no en otro día de la semana; una fecha exceptuada no aparece; una sesión única sólo aparece en su fecha; un turno cancelado no aparece; el filtro por profesor acota.

**Criterios de aceptación**

- Con turnos cargados, la agenda del día los devuelve todos, ordenados por hora.
- Un recurrente con excepción en esa fecha no figura.
- Sin `fecha`, responde la del día en curso según la zona del negocio.

---

## T-24 · [Front] HU-09 · Pantalla de agenda diaria del centro

- **HU:** HU-09 Ver agenda diaria del centro
- **Área:** Frontend
- **Rama:** `feat/agenda-diaria-ui`
- **Depende de:** T-23, T-04 (puede empezar en paralelo)

**Descripción**
Construir la pantalla de agenda diaria de mesa de entradas, que hoy existe como placeholder.

**Alcance**

1. Pantalla en el segmento de mesa de entradas, con los turnos del día: alumno, profesor, materia, aula, horario y estado ("Agendado" para los `ACTIVO`, ver T-21).
2. Navegación a días anteriores y posteriores, y vuelta a "Hoy". Al entrar, se muestra el día en curso.
3. Filtro por profesor, con el hook del listado de profesores de `features/profesores`.
4. Estados de carga, vacío ("No hay turnos para este día") y error (401/403), como pide la Definición de Hecho.
5. **Renombrar la sección:** hoy la página es `app/mesa/calendario/page.tsx` y el sidebar la llama "Calendario". La HU y T-04 la llaman **"Agenda diaria"**: renombrar la ruta a `app/mesa/agenda/` y el ítem del sidebar, y actualizar `docs/arquitectura-frontend.md` → Estructura en el mismo PR.
6. Fechas siempre como string `YYYY-MM-DD`; el día que se propone al entrar sale del navegador con `format(new Date(), 'yyyy-MM-dd')`, pero qué turnos corresponden lo decide la API.

**Criterios de aceptación**

- Al entrar se ve la agenda de hoy; se puede ir al día anterior y al siguiente.
- El filtro por profesor acota la lista y se combina con la fecha.
- Un día sin turnos muestra el estado vacío.

---

## T-25 · [Back] HU-10 · API de la agenda propia del profesor (opcional)

- **HU:** HU-10 Ver agenda propia del profesor
- **Área:** Backend
- **Rama:** `feat/agenda-profesor-api`
- **Depende de:** T-23
- **Prioridad:** Opcional. La HU se incluye sólo si el equipo tiene margen; se hace después de HU-09

**Descripción**
Exponer la agenda del profesor de la sesión, de sólo lectura. Rol `PROFESOR`.

**Alcance**

1. `GET /api/v1/turnos/agenda-propia?desde&hasta?`: los turnos del profesor **de la sesión**, para un día o un rango (la HU pide vista por día o por semana). El profesor sale del `Actor` del contexto: **nunca de un parámetro**, para que nadie pueda pedir la agenda de otro.
2. Reutiliza la expansión de ocurrencias de T-23: no se reescribe.
3. Cada ítem: alumno, materia, aula, horario y estado. Sin datos de otros profesores.
4. Sólo lectura: en este incremento el profesor no edita ni cancela turnos.
5. Tests del service: la agenda devuelve sólo los turnos del profesor de la sesión, y un rango de una semana trae los días que corresponden.

**Criterios de aceptación**

- Un profesor ve sus turnos y no los de otro.
- Un usuario `MESA_ENTRADAS` que llama a este endpoint recibe 403.

---

## T-26 · [Front] HU-10 · Pantalla de agenda del profesor (opcional)

- **HU:** HU-10 Ver agenda propia del profesor
- **Área:** Frontend
- **Rama:** `feat/agenda-profesor-ui`
- **Depende de:** T-25, T-04 (puede empezar en paralelo)
- **Prioridad:** Opcional, igual que T-25

**Descripción**
Completar la pantalla "Mi agenda" del segmento de profesor, que hoy existe como placeholder (`app/profesor/agenda/page.tsx`).

**Alcance**

1. Vista de sólo lectura con los turnos propios, por día o por semana, con un selector entre las dos vistas.
2. Cada turno con alumno, materia, aula, horario y estado.
3. Navegación entre días o semanas, empezando por el día en curso.
4. Estados de carga, vacío y error (401/403).
5. Sin acciones de edición ni cancelación: no se muestran botones que la API no soporta en este incremento.

**Criterios de aceptación**

- El profesor del seed ve sus turnos al entrar a "Mi agenda".
- Se puede cambiar entre vista por día y por semana, y navegar hacia adelante y atrás.
- No hay ninguna acción que modifique un turno.

---

## T-27 · [Back] FIX · HU-01 · DNI del tutor obligatorio para alumnos menores

- **HU:** HU-01 Gestión de datos del alumno
- **Área:** Backend
- **Rama:** `fix/alumnos-tutor-dni`
- **Depende de:** T-05 (mergeada)

**Descripción**
El Product Backlog v4 pide, para un alumno menor de edad, "teléfono y email de un tutor o responsable como así también su nombre, apellido y **DNI**". T-05 se implementó con el DNI del tutor **opcional**, siguiendo la decisión T-25 de `docs/decisiones.md`. El equipo resolvió que **manda el backlog**: el DNI del tutor pasa a ser obligatorio para menores, igual que el resto de los datos del tutor.

Es un cambio chico y muy localizado: en `alumnos.service.ts` la regla ya está escrita como una lista de campos obligatorios (`TUTOR_OBLIGATORIO`), así que alcanza con sumar `tutorDni` y corregir lo que quedó dicho alrededor.

**Alcance**

1. `src/server/features/alumnos/alumnos.service.ts`: agregar `tutorDni` a la lista de campos del tutor obligatorios para menores, y sacar el comentario que dice que no lo es. El 400 sigue siendo **uno solo** con todos los campos faltantes en `details`, como está hoy: no se agrega un error aparte.
2. `src/server/features/alumnos/alumnos.validation.ts`: el campo sigue siendo opcional en el schema Zod (la obligatoriedad depende de la edad, que la decide el service), pero su `description` de OpenAPI pasa a decir "Obligatorio si el alumno es menor", igual que los otros campos del tutor.
3. La regla vale también **al editar**, sobre el alumno resultante: no se puede dejar sin DNI al tutor de un menor. Ya funciona así para los demás campos del tutor; al sumar `tutorDni` a la lista queda cubierto, pero hay que verificarlo con un test.
4. El schema de Prisma **no cambia**: `tutorDni` sigue siendo una columna opcional. La obligatoriedad es de la API y depende de la edad, que la base no puede evaluar. **No hay migración.**
5. Tests del service: alta de un menor sin DNI del tutor → 400 con `tutorDni` entre los campos marcados; edición que borra el DNI del tutor de un menor → 400; alta de un mayor sin datos de tutor → sigue pasando.
6. **Documentación (mismo PR, regla 9):**
   - `docs/dominio.md` → Alumnos: hoy dice "(el DNI del tutor es opcional)". Pasa a estar entre los datos obligatorios del tutor para menores.
   - `docs/decisiones.md` → **T-25**: la decisión cambia, así que se actualiza ahí mismo (es lo que pide el encabezado del propio doc: "si cambia, se actualiza acá y en el doc afectado en el mismo PR"), dejando dicho que el DNI del tutor pasó a obligatorio por el backlog v4 y que el equipo resolvió darle prioridad al backlog sobre la confirmación anterior de las PO. Conviene que quede avisado a las PO, porque la decisión original salió de ellas.

**Fuera de alcance**

- El frontend **no lleva tarea FIX propia**: T-06 (pantallas de alumnos) todavía no está implementada (`src/features/alumnos/` sigue siendo el esqueleto). Quien tome T-06 construye el formulario ya con el DNI del tutor entre los campos obligatorios para menores; el alcance de T-06 no cambia, porque ahí la regla está escrita de forma genérica ("si faltan los datos del tutor, la API responde 400 y el formulario marca esos campos").

**Criterios de aceptación**

- Un alta de alumno menor sin DNI del tutor responde 400 y el campo aparece entre los marcados, en el mismo error que los demás datos del tutor faltantes.
- Editar un alumno menor borrándole el DNI del tutor responde 400.
- Un alumno mayor de edad sigue pudiendo guardarse sin ningún dato de tutor.
- `docs/dominio.md` y la decisión T-25 quedan consistentes con la regla nueva.
