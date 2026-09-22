Vamos a implementar la tarea **T-01 · Modelo de datos: esquema Prisma, migración inicial y seed**. Ya estoy parado en la rama `feat/modelo-datos-inicial`. No crees ramas ni hagas commits. **No ejecutes migraciones** (`AGENTS.md`, regla 10). `pnpm db:generate` y `pnpm check` sí están permitidos.

Antes de escribir código, leé:

- `AGENTS.md`
- `docs/convenciones-backend.md`
- `docs/decisiones.md`
- `docs/dominio.md`
- `docs/contrato-api.md`
- `docs/arquitectura-backend.md` (Prisma y auth)
- `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/config/env.ts`
- `prisma7.config.ts`, `.env.example`, `package.json`

Para Better Auth 1.7.5, verificá en `node_modules` (no de memoria):

- el schema que exige (`@better-auth/core/dist/db/get-tables.mjs`);
- el adaptador de Prisma, que usa `db[modelName]`;
- `better-auth/crypto` (`hashPassword`).

Si algo de este prompt contradice lo que encuentres en el código instalado, frená y preguntame.

## Decisiones ya tomadas (no las vuelvas a discutir)

1. **Rol:** tabla catálogo `Rol` con PK de texto: `id String @id` con valores `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO`, más `nombre`, `descripcion` y `estado`. Sin auditoría: es un catálogo que carga el seed. `Usuario.role` es un FK `String` NOT NULL a `Rol.id`. Así Better Auth recibe el código como string (`additionalFields.role`) y la base impide valores inválidos. Un solo rol por usuario.
2. **Alumno lleva `estado`** (`ACTIVO` por defecto), como está en el DER. La baja no se implementa en este sprint. Corregí `dominio.md`, que hoy dice que no tienen baja lógica.
3. **`EstadoTurno`:** `ACTIVO` / `CANCELADO`. La vigencia se calcula por fechas, nunca por el estado.
4. **D-03 (recurrentes):** se guarda la regla (el turno con `fechaInicio` y `fechaFin` opcional) y las excepciones en `TurnoExcepcion`. Las ocurrencias se expanden al consultar. La prioridad no se persiste.
5. **Profesor sin `estado` propio:** su baja lógica es `Usuario.estado`, que además bloquea el login cuando se implemente T-03. Tampoco lleva auditoría propia: la toma de su `Usuario`.
6. **IDs:** `Usuario.id` es `String` (lo genera Better Auth). El resto de las entidades usa `Int @id @default(autoincrement())`. Los FKs de auditoría son `String` hacia `Usuario`.
7. **Tablas de Better Auth:** los modelos `Session`, `Account` y `Verification` conservan los nombres por defecto de Better Auth (son infraestructura). El usuario es el modelo de dominio `Usuario`: en `auth.ts` se configura `user.modelName: 'usuario'` (el nombre del delegate de Prisma) y `user.fields` para mapear `name → nombre`. `emailVerified` (default false) e `image` (opcional, sin uso; la foto va por `avatarKey`) se mantienen porque Better Auth los exige. Las relaciones de `Session` y `Account` hacia `Usuario` van con `onDelete: Cascade`, como define Better Auth.

## Convenciones del schema

- Modelos en PascalCase y campos en camelCase. Tablas y columnas en **snake_case minúscula** con `@@map` y `@map` (nada de `FK_…` en mayúsculas, que obliga a usar comillas en SQL). Unificá los nombres inconsistentes del DER:
  - `nombre_alumno` → `nombre`
  - `id_profesor` y `FK_usuario` → `profesor_id` y `usuario_id`
  - `texto_busqueda` y `nombre_normalizado` → campo `busqueda` (columna `busqueda`)
- Auditoría en cada entidad de negocio: `createdById`, `updatedById`, `createdAt` (`@default(now())`) y `updatedAt` (`@updatedAt`), con columnas `usuario_creador_id`, `usuario_modificador_id`, `fecha_hora_creacion` y `fecha_hora_modificacion`. Usá relaciones con nombre hacia `Usuario` y `onDelete: Restrict`. En `Usuario` los dos FKs son opcionales (autorreferencia; el seed no tiene creador). En el resto son obligatorios.
- Enum `Estado { ACTIVO INACTIVO }` con `@default(ACTIVO)`.
- Fechas de calendario con `@db.Date`. Horas en minutos desde medianoche (`Int`). Día de la semana ISO 1..7.
- Todos los FKs con índice. Índice en `apellido` (Usuario y Alumno).

## Entidades (del DER, con las correcciones)

- **Rol**: ver la decisión 1.
- **Usuario**: `id`, `nombre`, `apellido`, `dni` (UNIQUE), `busqueda` (índice), `telefono`, `email` (UNIQUE), `emailVerified`, `image?`, `role` (FK a Rol), `avatarKey?`, `avatarMimeType?`, `avatarUpdatedAt?`, `estado` y auditoría. **Sin** `password_hash`: la contraseña vive en `Account.password` (providerId `credential`), que es donde la busca Better Auth. Corregilo también en el DER más adelante (yo me encargo).
- **Profesor**: `id`, `usuarioId` (`String @unique`, obligatorio), `titulo`, `matricula` (UNIQUE).
- **Alumno**: todos los campos del DER. Los marcados con `*` son opcionales. `dni` UNIQUE, `busqueda` y `estado`. `nivelEscolaridad` es el enum `NivelEscolaridad { INICIAL PRIMARIO SECUNDARIO TERCIARIO UNIVERSITARIO }`, opcional. Sin vínculo a `Usuario` todavía: el portal del alumno llega en el Sprint 3.
- **Materia**: `nombre`, `busqueda` **UNIQUE** (nombre normalizado: resuelve la unicidad sin mayúsculas ni tildes), `descripcion?`, `estado` y auditoría.
- **AsignacionMateria**: `profesorId`, `materiaId`, `estado`, **auditoría** (el DER no la tiene, pero `dominio.md` la exige) y `@@unique([profesorId, materiaId])`. Quitar una materia = pasar a `INACTIVO`; reasignarla = reactivar esa misma fila.
- **BloqueAgenda**: `profesorId`, `diaSemana`, `horaInicio`, `horaFin`, `capacidad`, `estado` y auditoría. Índice `(profesorId, diaSemana)`.
- **Turno**: `bloqueAgendaId`, `alumnoId`, `materiaId`, `tipo` (enum `TipoTurno { RECURRENTE SESION_UNICA }`), `fechaInicio`, `fechaFin?`, `motivoConsulta?`, `estado` (`EstadoTurno`, `@default(ACTIVO)`) y auditoría. Índices en `(bloqueAgendaId, fechaInicio)` y en `alumnoId`. En una `SESION_UNICA`, `fechaFin = fechaInicio`: así la consulta de "vigente" es una sola condición.
- **TurnoExcepcion**: `turnoId`, `fecha`, `turnoReemplazoId?` (dos relaciones con nombre hacia `Turno`), auditoría y `@@unique([turnoId, fecha])`.
- **ExamenMateria** (está en el DER aunque la tarea no la lista; la prioridad depende de ella): `alumnoId`, `materiaId`, `fecha`, auditoría, `@@unique([alumnoId, materiaId, fecha])` e índice `(alumnoId, materiaId, fecha)`.

## Restricciones CHECK

Prisma no las genera, y vos no podés tocar `prisma/migrations/`. **No las implementes.** En tu resumen final dame el SQL listo para pegar al final del `migration.sql`. Yo voy a generar la migración con `pnpm prisma migrate dev --create-only --name init`, pegar el SQL y aplicarla. Las restricciones son:

- `bloque_agenda`:
  - `dia_semana BETWEEN 1 AND 7`
  - `hora_inicio BETWEEN 0 AND 1439`
  - `hora_fin BETWEEN 1 AND 1440`
  - `hora_fin > hora_inicio`
  - `capacidad > 0`
- `turno`:
  - `fecha_fin IS NULL OR fecha_fin >= fecha_inicio`
  - `tipo <> 'SESION_UNICA' OR fecha_fin = fecha_inicio`

Usá los nombres reales de tablas y columnas que hayas definido.

## `src/lib/auth.ts` (mínimo imprescindible; el resto es T-03)

- `user.modelName` y `user.fields` según la decisión 7. `additionalFields` con `role` (`input: false`) y el resto de los campos obligatorios de `Usuario` que Better Auth necesite conocer (`apellido`, `dni`, `busqueda`, `telefono`, `estado`), todos con `input: false`. Verificá cómo trata Better Auth los campos NOT NULL que no conoce.
- Exportá un helper `hashPassword(plain)` que use el mismo hasher que Better Auth: `(await auth.$context).password.hash`, o `hashPassword` de `better-auth/crypto` si no hay un hasher custom. Lo usan el seed y, más adelante, el alta de profesor.
- **No** agregues `disableSignUp` ni la lógica de login por estado: eso es de T-03. Dejá un comentario si hace falta.

## Seed (`prisma/seed.ts`)

- Registralo en `prisma7.config.ts` (`migrations.seed: 'tsx prisma/seed.ts'`; verificá la sintaxis de Prisma 7) y agregá el script `"db:seed": "prisma db seed"`. En Prisma 7, `migrate dev` ya no corre el seed solo: documentalo.
- Idempotente, todo con `upsert` por clave natural: roles por `id`, usuarios por `email`, cuenta por `(providerId, accountId)` o buscándola por `userId`, profesor por `usuarioId`, materias por `busqueda`.
- Carga los 4 roles. Crea los usuarios `MESA_ENTRADAS`, `PROFESOR` (con su fila en `Profesor` y matrícula de ejemplo) y `GERENTE`, cada uno con su `Account` (`providerId: 'credential'`, `accountId: usuario.id`, `password` hasheada con el helper de `auth.ts`). **No** uses `auth.api.signUpEmail`.
- `busqueda` calculada con `normalizarBusqueda()`. Si `src/server/shared/busqueda.ts` (T-02) todavía no existe, **frená y preguntame** antes de escribir una versión propia (`AGENTS.md`, regla 6).
- Carga 5 o 6 materias de ejemplo (por ejemplo Matemática, Física, Química, Lengua, Inglés, Contabilidad) creadas por el gerente.
- Emails y contraseñas por variables de entorno: `SEED_MESA_ENTRADAS_EMAIL`/`_PASSWORD`, `SEED_PROFESOR_EMAIL`/`_PASSWORD`, `SEED_GERENTE_EMAIL`/`_PASSWORD`. Agregalas a `.env.example` **y** a `src/config/env.ts` como `.optional()`, para no romper el arranque de la app (regla 4). El seed falla con un mensaje claro si faltan. El seed lee la configuración a través de `env`, no de `process.env`.
- `prisma/seed.ts` usa Prisma directo: agregalo como excepción en la regla 3 de `AGENTS.md` y en `docs/arquitectura-backend.md` (Prisma), y verificá que ESLint no lo bloquee.

## Documentación (mismo PR, regla 9)

- `docs/decisiones.md`: pasan a **Tomadas**, con su porqué, las decisiones de este prompt:
  - D-01 (valores del rol)
  - D-02 (los alumnos tienen portal en el Sprint 3)
  - D-03 (regla + excepciones)
  - D-05 (el seed escribe `Usuario` + `Account` credential con el helper de hash)
  - D-10, nueva: vínculo cuenta ↔ profesor. `Profesor` tiene un FK único y obligatorio a `Usuario`, y mesa de entradas crea la cuenta con una contraseña inicial.

  D-04 sigue abierta.

- `docs/dominio.md`: la sección Roles con los valores técnicos; alumnos con baja lógica (no implementada en este release); profesor inactivo = `Usuario` inactivo.
- `docs/convenciones-backend.md`: la columna `busqueda` también en materias (UNIQUE); marcá como construido lo que corresponda en la tabla de Estado.
- `docs/contrato-api.md`: agregá la sección **Roles** con los 4 valores.
- `src/types/index.ts`: `Role` pasa a los valores en mayúsculas (cambió el contrato).
- `README.md`: cómo levantar los servicios, migrar (`pnpm db:migrate`), correr el seed (`pnpm db:seed`) y las credenciales de desarrollo por variables de entorno.

## Al terminar

1. Corré `pnpm db:generate` y `pnpm check` y reportá el resultado real.
2. Resumí qué cambió en `schema.prisma`, `auth.ts`, `env.ts`, el seed y los docs.
3. Dame el SQL de los CHECK y los pasos exactos para mí:
   1. `pnpm prisma migrate dev --create-only --name init`
   2. pegar los CHECK
   3. `pnpm db:migrate`
   4. `pnpm db:seed` dos veces, para verificar la idempotencia
4. Dame 4 consultas SQL de verificación de los criterios de aceptación, que tienen que fallar:
   - DNI de alumno duplicado
   - matrícula duplicada
   - email duplicado
   - una materia "matematica" contra "Matemática", insertando el `busqueda` normalizado
5. Listá todo lo que hayas supuesto o dejado pendiente.
