# Sprint 1 — Tareas (HU-00 a HU-04)

Repositorio: `aula-click` · Sprint: Iteración 1 · Estado inicial de todas las tareas: **Todo**

Estas tareas siguen `AGENTS.md` y `docs/`. Si una tarea y un doc se contradicen, manda el doc y se avisa para corregir la tarea.

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
- Nadie genera migraciones propias hasta que T-01 esté mergeada.
- Las APIs necesitan T-01, T-02 y T-03. Las pantallas pueden empezar en paralelo con su API, contra el contrato de `docs/contrato-api.md` y el OpenAPI (`/api/v1/docs`), y se conectan cuando la API se mergea.
- `alumnos` es la feature modelo que copian las demás (`/nueva-feature-api`, `/nueva-feature-ui`). Conviene que T-05 y T-06 abran su PR temprano para que profesores y materias sigan el mismo patrón.

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
   - No puede usar `auth.api.signUpEmail`, porque con `disableSignUp` queda bloqueado (D-05). Las cuentas se crean escribiendo `Usuario` y su cuenta de tipo credencial, con la contraseña hasheada por el helper de hash que expone `src/lib/auth.ts` (ver T-03). Así el seed y el alta de profesor usan el mismo mecanismo.
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
2. Sesión con vencimiento por inactividad: se renueva con la actividad y vence tras un período sin uso (propuesta: 60 minutos, a confirmar con los PO).
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
3. Segmentos de URL por rol (decisión T-19): migrar `(personal-mesa-entradas)` a `app/mesa/` y crear `app/profesor/`. `/gerente` y `/portal` no se crean en este sprint.
4. Tras el login, redirigir al inicio del rol. Si un usuario entra a un segmento de otro rol, redirigirlo al suyo (es navegación, no seguridad: la seguridad la da la API).
5. `AppShell`, `header.tsx` (logo, usuario, botón "Cerrar sesión") y un sidebar por rol en `components/layout/`. El layout raíz sólo monta `<Providers>`.
   - Mesa de entradas: Alumnos, Profesores, Materias, Turnos, Agenda diaria.
   - Profesor: Mi agenda, Mis alumnos.
   - Las pantallas de HU aún no implementadas quedan como páginas con su título.
6. Manejo centralizado del 401 en `providers.tsx` (`onError` de `QueryCache` y `MutationCache`): redirige a `/login` con el aviso "Tu sesión expiró".
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
   - Obligatorios: nombre, apellido, DNI, fecha de nacimiento, teléfono, email y nivel de escolaridad (nivel y grado o año).
   - Opcionales: colegio y observaciones.
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
   - El schema del frontend valida sólo formato (DNI, email, teléfono, fecha `YYYY-MM-DD`).
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
   - Obligatorios: nombre, apellido, DNI, teléfono, email, título, matrícula y contraseña inicial (largo mínimo según la configuración de Better Auth).
   - En una sola transacción del repository crea `Usuario` (rol `PROFESOR`), su cuenta de tipo credencial con la contraseña hasheada por el helper de `src/lib/auth.ts` (T-03) y `Profesor` en estado `ACTIVO`. Si algo falla, no queda nada creado.
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
3. Botón "+ Nuevo profesor". Formulario de alta con todos los datos, contraseña inicial y su confirmación (ambas enmascaradas). La edición no muestra la contraseña.
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
3. `DELETE /api/v1/profesores/{id}/materias/{materiaId}`: baja lógica de la asignación (`estado = INACTIVO`), nunca borrado físico.
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
