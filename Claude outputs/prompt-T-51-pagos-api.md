# Prompt para Claude Code · T-51 · [Back] HU-15 · API para registrar el pago de turnos y su comprobante

> **Antes de pegarlo (lo hacés vos):**
>
> - T-30 y T-63 tienen que estar mergeadas en `testing` (lo están: #122 y la migración `fix_modelo_sprint_2`), y T-39 también, porque el importe sale de `Materia.precioHora`.
> - La rama `feat/pagos-api` ya existe y está limpia. Traela al último `testing`:
>
> ```bash
> git switch testing && git pull
> git switch feat/pagos-api && git merge --ff-only testing
> pnpm install && pnpm db:generate
> pnpm db:migrate            # si todavía no aplicaste la de T-63
> pnpm db:seed
> pnpm check                 # la línea de base tiene que estar en verde
> ```

---

Vas a implementar **T-51** (`docs/sprint-2/sprint-2.md` → "T-51 · [Back] HU-15 · API para registrar el pago de turnos y su comprobante") en la rama `feat/pagos-api`, que ya está creada desde `testing`.

Trabajá como backend senior. Es dinero: **todo o nada**, importes exactos en centavos, sin pago doble y sin reglas repetidas en otras features. La feature `pagos` ya existe con su router vacío (T-32) y está registrada en `app.ts`, así que `app.ts` **no se toca**.

## 0. Leer antes de escribir código (en este orden)

1. `AGENTS.md`, `CLAUDE.md` y `.claude/rules/backend.md`. Importan sobre todo la regla 9 (docs en el mismo cambio) y la regla 10 (no generar ni aplicar migraciones).
2. `docs/sprint-2/sprint-2.md`:
   - la tarea T-51;
   - **"Definiciones de las PO (29/09)"**: B, D, E y F;
   - el vocabulario, la Definición de Hecho, el mapa de archivos y la regla de aislamiento;
   - T-43, T-45, T-52 y T-53, para ver quién consume lo que publicás. T-52 es la pantalla y el comprobante imprimible, así que arma su UI con tu respuesta.
3. `docs/arquitectura-backend.md`, `docs/convenciones-backend.md` (en especial **Importes**, **Ocurrencias**, **Auditoría y Actor** y **Concurrencia**), `docs/contrato-api.md` (Errores y el formato de otras features) y `docs/dominio.md`. En `dominio.md`, "Pagos" aparece dos veces: el modelo (T-29/T-63) y la sección "A completar por T-51". En `docs/decisiones.md` leé T-38, T-39, T-46, T-49, T-56, T-57 y las demás filas del Sprint 2, y fijate cuál es el **último ID** (hoy es T-58).
4. `prisma/schema.prisma`: `Pago`, `PagoTurno` (`fechaOcurrencia`, `importeAplicado` y `@@unique([turnoId, fechaOcurrencia])`), `FormaPago`, `Materia.precioHora` y `EstadoPago`. Revisá también `prisma/seed.ts` (forma de pago "Efectivo") y `prisma/seed-datos-demo.ts` (los pagos de demo que ya existen).
5. `src/server/features/turnos/ocurrencias.condiciones.ts` completo, con su test: `leerOcurrencias`, el tipo `Ocurrencia` (horas en minutos, `pago`, `materia`, `profesor`) y `bloquearParaReserva`.
6. La feature `alumnos` completa: es el patrón de los 5 archivos + `__tests__/`. Mirá también cómo `turnos` resuelve la transacción con callback (`reservar` / `planificar`) y el repository en memoria de sus tests (`turnos-en-memoria.ts`), que es el precedente del test de concurrencia.
7. Cómo `materias.repository` y `alumnos.repository` traducen P2002 con Prisma 7 + `@prisma/adapter-pg`: el nombre del constraint viene en `meta.driverAdapterError.cause.constraint`.
8. `src/server/errors/` (clases, `ErrorResponseSchema`, cómo se declara un `code` propio como `ALUMNO_SUPERPUESTO`), `src/server/shared/` (`fechas.ts`, `zod.ts`, `auditoria.ts` y `actor.ts`), y `eslint.config.mjs` con `src/server/shared/__tests__/eslint-limites.test.ts`. Recordá los límites:
   - un service no usa Prisma;
   - de otra feature sólo se importan `*.repository` y `*.condiciones`;
   - un repository no importa el repository de otra feature.

Después de leer, **presentame un plan corto antes de escribir código** con:

- los archivos que creás o tocás;
- los schemas de body y respuesta;
- el orden exacto de los chequeos del `POST`;
- qué hace el service y qué hace el repository dentro de la transacción;
- cómo vas a testear la concurrencia.

Si algo de este prompt contradice un doc o el código, **frená y avisame**.

## 1. Decisiones ya tomadas (no están en la tarea; las confirmé yo)

1. **El lock del pago es sólo el alumno.**
   - `bloquearParaReserva` recibe un solo `profesorId`, y un pago puede incluir turnos de varios profesores del mismo alumno.
   - Al pago no le importa la ocupación. Lo que tiene que serializar es el **estado de cada ocurrencia**: cancelarla (T-45), reprogramarla (T-49, que re-apunta el `PagoTurno`), finalizar la serie (T-47) u otro pago. Todas esas escrituras toman `alumno FOR UPDATE` como último paso del orden de locks.
   - Tomar sólo ese paso es un **sufijo** del orden, así que no hay deadlock posible.
   - **Implementación:**
     - Agregá en `turnos/ocurrencias.condiciones.ts` un `bloquearAlumno(tx, alumnoId)` (`SELECT id FROM alumno WHERE id = ${alumnoId} FOR UPDATE`, con el tagged template).
     - Hacé que `bloquearParaReserva` lo use para su paso 3, así el orden sigue teniendo **una sola implementación**.
     - JSDoc: se llama antes de cualquier lectura de la transacción. Es para escrituras que dependen del estado de las ocurrencias de un alumno pero no de la ocupación (el pago; T-45 puede usarlo por la misma razón).
     - Test: el `$queryRaw` con el id como parámetro, y `bloquearParaReserva` sigue tomando los tres locks en el mismo orden.
   - Ese archivo es de T-30 (ya mergeada): es **el único archivo fuera de `pagos/` y de `docs/` que tocás**, y lo avisás en la descripción del PR.
2. **Tope de 8 semanas para todas las ocurrencias futuras**, series y sesiones únicas: `fecha <= hoy + 56 días`. Si no, `FUERA_DE_RANGO` (409, ver §2). Las pasadas no tienen tope.
3. **Materia sin precio** (`precioHora` nulo): una ocurrencia así no se puede cobrar (`SIN_PRECIO`, 409). Puede pasar con turnos del Sprint 1 cuya materia quedó `INACTIVO` sin precio. Una materia `INACTIVO` **con** precio se cobra con ese precio: el estado de la materia no importa.
4. **`numeroComprobante`** es el `autoincrement` del schema: correlativo y único, pero una transacción que falla después del `INSERT` deja un hueco en la numeración (así funcionan las secuencias de Postgres). Se acepta y se documenta: no es un comprobante fiscal, y cerrar los huecos exige serializar todos los pagos.
5. **El comprobante muestra los datos actuales de cada turno.** Si una ocurrencia pagada se reprograma, T-49 re-apunta su `PagoTurno` al turno nuevo, y reimprimir el comprobante muestra la fecha, la hora y el profesor nuevos. El importe no cambia, porque es `importeAplicado`. Se documenta.

## 2. `POST /pagos` (`MESA_ENTRADAS`, 201)

**Body:** `{ alumnoId, ocurrencias: [{ turnoId, fecha }], fechaPago, montoRecibido?, observaciones? }`

**Validación (Zod, 400 `VALIDACION` con el campo en `details`):**

- `ocurrencias`: entre 1 y 200. Sin repetidos `(turnoId, fecha)`: si hay, 400 en `ocurrencias`. `fecha` en `YYYY-MM-DD`.
- `fechaPago`: `YYYY-MM-DD`, obligatoria y **no posterior a `hoy()`**. Se chequea en el service con el reloj inyectable; en Zod va sólo el formato.
- `montoRecibido`: opcional; mayor que 0, con hasta dos decimales y que entre en `Decimal(10,2)`.
  - La regla `>= total` la chequea el service, porque el total sale del precio vigente.
  - Si no se cumple: 400 `VALIDACION` en `montoRecibido`, con un mensaje que diga el total, por ejemplo "El monto recibido ($ 30.000) es menor al total ($ 32.000)". Así T-52 lo pinta en el campo.
- `observaciones`: hasta 500 caracteres, con `textoOpcional` de `shared/zod`.
- El esquema de importe de `materias.validation` es privado de esa feature: definí el tuyo en `pagos.validation`. Si queda idéntico, anotalo en el resumen como candidato a `shared/zod`, pero **no toques `materias`**.
- La forma de pago **no** viene en el body.

**Orden de los chequeos** (el primero que falla gana; son errores claros para el front):

1. Body inválido → 400.
2. `fechaPago` futura → 400 en `fechaPago`.
3. Alumno inexistente → 404. Usá el `alumnosRepository` que ya existe; el estado del alumno no importa, porque una deuda se cobra igual.
4. Leés las ocurrencias con **una** llamada a `leerOcurrencias`:
   - con `turnoIds` del pedido y el rango `[mín fecha, máx fecha]`, **sin** `alumnoId`, para poder distinguir "de otro alumno";
   - con el reloj del service.

   Un par del pedido que no está en el resultado es `NO_EXISTE`: turno inexistente, turno `CANCELADO` legado o fecha que no es una ocurrencia suya (por ejemplo, posterior al fin efectivo).

5. Alguna ocurrencia existente es de otro alumno → 400 `VALIDACION` en `ocurrencias`, con cuáles.
6. Cobrabilidad de cada una. Si **alguna** falla → 409 **`TURNOS_NO_COBRABLES`** con `details: [{ turnoId, fecha, motivo, mensaje }]` de **todas** las que fallan (no sólo la primera). Los motivos:

   | Motivo           | Cuándo                           | Mensaje                                                  |
   | ---------------- | -------------------------------- | -------------------------------------------------------- |
   | `NO_EXISTE`      | ver el paso 4                    | "El turno no existe en esa fecha"                        |
   | `CANCELADO`      | estado `CANCELADO`               | "El turno está cancelado"                                |
   | `YA_PAGADO`      | pago `PAGADO` (incluí `pagoId`)  | "El turno ya está pagado"                                |
   | `FUERA_DE_RANGO` | fecha > hoy + 56                 | "Sólo se pueden cobrar turnos de las próximas 8 semanas" |
   | `SIN_PRECIO`     | la materia no tiene `precioHora` | "La materia no tiene precio cargado"                     |

   Si una ocurrencia cumple varios motivos, uno solo, en el orden de la tabla. Cobrables = estado `AGENDADO` o `SIN_REGISTRAR` (definición F) y pago `PENDIENTE`.

7. Importes:
   - `importeAplicado` = `precioHora` vigente de su materia;
   - `total` = suma **en centavos** (convenciones → Importes);
   - si viene `montoRecibido < total` → 400 como en §2;
   - `vuelto` = `montoRecibido - total` (en centavos), o `null` si no vino `montoRecibido`. **No se guarda.**

**Reparto service / repository** (el mismo patrón que `reservar` / `planificar` y `verificar`):

- **Reglas puras** en `pagos.reglas.ts` (sin Prisma y sin `hoy()` adentro), testeadas aparte:
  - `planificarPago(snapshot, pedido, hoy)` → `{ lineas: [{ turnoId, fecha, importe }], total, vuelto }` o lanza el error que corresponde (pasos 4 a 7);
  - la constante de 56 días y los mensajes.
- **Service:**
  - chequeos 1 a 3;
  - un chequeo previo con el snapshot leído fuera de la transacción, para dar errores claros sin tomar locks;
  - después llama a `pagosRepository.registrar(datos, verificar)`, con `verificar` = la misma regla pura.
- **`pagosRepository.registrar`**, en una sola `prisma.$transaction`:
  1. `bloquearAlumno(tx, alumnoId)`: **lo primero**, antes de cualquier lectura.
  2. Relee con `tx` las ocurrencias (`leerOcurrencias`), los `precioHora` de sus materias (un `findMany` por `id IN`: el tipo `Ocurrencia` no trae el precio) y la forma de pago "Efectivo".
     - Esta última es una constante de la feature y `ACTIVO`. Si no existe, es un error de configuración (500 con un mensaje claro que diga que falta correr el seed), no un 4xx.
  3. Ejecuta `verificar(snapshot)`. Si lanza, no se escribe nada.
  4. Crea el `Pago` (`importeTotal`, `fechaPago`, `montoRecibido` o `null`, `observaciones`, `formaPagoId`, `estado` por defecto `VIGENTE`, `createdById` y `updatedById` del actor) con sus `PagoTurno` anidados (`fechaOcurrencia` = la fecha de la ocurrencia, `importeAplicado`).
  5. Una **P2002 del único `(turnoId, fechaOcurrencia)`** de `pago_turno` se traduce a 409 `TURNOS_NO_COBRABLES`, "Alguno de los turnos ya fue pagado", sin `details` por ocurrencia, porque la transacción ya se abortó. Con el lock del alumno no debería pasar: es la última red.
  6. Los importes salen del repository como `number` (`toNumber()`), nunca como `Prisma.Decimal`.

**Respuesta 201:** `{ pagoId, numeroComprobante, cantidad, total, montoRecibido: number | null, vuelto: number | null }`. Con eso T-52 arma "Pago registrado: 4 turnos por $ 32.000" y "Vuelto: $ 3.000". La API no manda textos formateados.

## 3. `GET /pagos/{id}` (`MESA_ENTRADAS`)

Son los datos del comprobante. **404** si no existe.

```ts
{
  id, numeroComprobante,
  fechaPago,                       // YYYY-MM-DD
  alumno: { id, nombre, apellido, dni },
  turnos: [{ turnoId, fecha, horaInicio, horaFin,        // "HH:MM"
             materia: { id, nombre },
             profesor: { id, nombre, apellido },
             importe }],                                  // importeAplicado
  total,                           // importeTotal
  montoRecibido: number | null,
  vuelto: number | null,           // recalculado, nunca leído de la base
  formaPago: { id, nombre },
  observaciones: string | null,
  registradoPor: UsuarioAuditoria, // createdBy, con el schema de shared/auditoria
  registradoEl                     // createdAt, con la convención de fechas y horas de los DTOs
}
```

- Una sola consulta: `pago` con `alumno`, `formaPago`, `createdBy` y `turnos` → `turno` → `bloqueAgenda` (horas y profesor → usuario) y `materia`.
  - No uses `leerOcurrencias`: el comprobante es de lo pagado, no de un rango.
  - Tomá los campos reales del profesor según el schema, como lo hace el tipo `Ocurrencia`.
- Los turnos van ordenados por fecha, hora de inicio y `turnoId`.
- `vuelto` se calcula con la misma función pura que el `POST`.

## 4. Archivos

- `src/server/features/pagos/`:
  - `pagos.routes.ts` (el router ya existe: sumá las rutas);
  - `pagos.controller.ts`, `pagos.validation.ts`, `pagos.service.ts`, `pagos.repository.ts`, `pagos.reglas.ts` y `pagos.ejemplos.ts`;
  - `__tests__/`.
- Cada endpoint con `createRoute()`, todos sus status (201/200, 400, 401, 403, 404, 409) con `ErrorResponseSchema`, `requireAuth()` + `requireRole('MESA_ENTRADAS')` y `example` de OpenAPI.
- Declará `TURNOS_NO_COBRABLES` como se declaran los demás códigos propios.
- `turnos/ocurrencias.condiciones.ts` (+ su test): sólo `bloquearAlumno` y su uso en `bloquearParaReserva` (§1.1).
- Nada más fuera de `pagos/` y `docs/`.

## 5. Tests

**Service** (repository mockeado, reloj fijo). Uno por cada error que lanza, más:

- un turno y varios turnos (de dos profesores distintos);
- cancelado → 409 `CANCELADO`, y ya pagado → 409 `YA_PAGADO`, **sin llamar a `registrar`**;
- uno cobrable y uno no en el mismo pedido → 409 con sólo el que falla en `details`, sin registrar nada;
- `fechaPago` futura → 400;
- alumno inexistente → 404;
- turno de otro alumno → 400;
- `NO_EXISTE` con una fecha posterior al fin efectivo;
- `FUERA_DE_RANGO` (hoy + 57) y el borde (hoy + 56 se cobra);
- `SIN_PRECIO`;
- una `SIN_REGISTRAR` (pasada) se cobra;
- `montoRecibido` menor al total → 400 en `montoRecibido`;
- `montoRecibido` igual al total → `vuelto: 0`;
- con `montoRecibido` responde el vuelto, y sin él `vuelto: null` y `montoRecibido: null`;
- el importe sale del precio vigente: con 3 × 10.000,50 el total es exacto en centavos;
- **dos pagos simultáneos de la misma ocurrencia → sólo uno**: con un repository en memoria que serializa como el lock (patrón de `turnos-en-memoria.ts`), el segundo recibe 409 `YA_PAGADO`;
- un cambio de precio posterior no cambia el `GET` de un pago ya registrado.

**Reglas puras:** `planificarPago` con cada motivo, el orden de los motivos, la suma en centavos y el vuelto.

**Repository** (excepcional, mockeando `tx`, como el test de T-23):

- `bloquearAlumno` es la **primera** llamada de la transacción;
- si `verificar` lanza, no hay `create`;
- una P2002 del constraint de `pago_turno` → 409 `TURNOS_NO_COBRABLES`, y otra P2002 no se traduce.

**Routes:** 401 sin sesión, 403 con `PROFESOR` y `GERENTE`, 201 y 200 felices, 400 de body.

## 6. Documentación (mismo PR, regla 9)

- **`docs/contrato-api.md` → Pagos:**
  - los dos endpoints con roles, body, respuestas y ejemplos;
  - `TURNOS_NO_COBRABLES` con sus motivos, y el código también en la tabla de Errores si ahí se listan;
  - una nota: los importes y el vuelto los calcula la API, y el cliente sólo los muestra.
- **`docs/dominio.md` → Pagos** (la sección "A completar por T-51"): qué es cobrable, el tope de 8 semanas, el precio vigente, todo o nada, el vuelto no guardado y el comprobante con los datos actuales del turno. No dupliques lo que ya dice la sección del modelo: enlazala.
- **`docs/convenciones-backend.md` → Concurrencia:** `bloquearAlumno` como paso 3 compartido, quién usa cada función (el pago, sólo el alumno) y por qué no hay deadlock (sufijo del orden). La línea que hoy dice que el pago usa `bloquearParaReserva` se corrige.
- **`docs/decisiones.md`:** filas nuevas desde el próximo ID libre (hoy T-59; respetá el ancho de columnas) con las cinco de §1, más el tope de 200 ocurrencias por pago y la P2002 sin detalle por ocurrencia.
- **No toques** `docs/sprint-2/*.md`. En el resumen, decime qué tareas conviene actualizar: T-45 podría usar `bloquearAlumno`, y T-43 y T-53 repiten las 8 semanas y el importe vigente.

## 7. Criterios de aceptación (verificalos uno por uno en el resumen)

- Al registrar, las ocurrencias pasan a `PAGADO` en `leerOcurrencias` y quedan vinculadas al mismo `pagoId` / comprobante.
- Cambiar el precio de la materia después no cambia el importe de un pago ya registrado.
- Un 409 no deja nada escrito: ni `Pago` ni `PagoTurno`.
- Fuera de `pagos/` y `docs/` sólo cambió `turnos/ocurrencias.condiciones.ts` y su test. Confirmalo con `git status`.

## 8. Fuera de alcance

- Anular un pago (definición D).
- Otras formas de pago (HU-23).
- La deuda y el historial (T-53).
- La UI y el comprobante imprimible (T-52).
- Cualquier cambio de schema o migración: si creés que hace falta, frená y preguntame.

## 9. Al terminar

1. Corré `pnpm check` y reportá el **resultado real**.
2. Corré `/revisar-arquitectura` y corregí lo que marque. La excepción de `ocurrencias.condiciones.ts` está acordada.
3. Verificación manual contra la base local (`pnpm services:up`, `pnpm db:seed`, `pnpm dev`). Pasame los requests (con la cookie de mesa de entradas de las seeds) para:
   - pagar dos ocurrencias pendientes de un alumno de la seed de demo, con `montoRecibido`;
   - repetir el mismo pago → 409 `YA_PAGADO`;
   - pagar una ocurrencia cancelada de la seed → 409 `CANCELADO`;
   - `GET /pagos/{id}` del pago creado;
   - `GET /agendas/diaria` o el test del motor mostrando esas ocurrencias como `PAGADO`.
4. **No commitees, no crees ramas y no corras migraciones.**
5. Resumen con:
   - archivos creados y tocados;
   - schemas finales de body y respuestas;
   - las funciones de `pagos.reglas.ts`;
   - los criterios de aceptación verificados;
   - las tareas cuyo texto conviene actualizar;
   - un texto corto para la descripción del PR sobre el archivo de T-30 tocado;
   - las decisiones que tomaste y no estaban acá.
