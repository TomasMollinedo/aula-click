# Prompts para Claude Code: agenda en la ficha del profesor (HU-02)

> **Contexto:** los PO pidieron que la ficha del profesor muestre también su agenda (HU-02: "su horario de atención (HU-05) junto con su agenda"). Todavía no tiene número de tarea. Tomás eligió la **vista semanal**, con el mismo alcance que las agendas que ya existen y nada más.
>
> **Qué ya está en `testing`** (y en la rama `feat/turnos-profesor`):
>
> - #65: `GET /turnos/agenda-propia?desde&hasta` (T-25, decisión T-43).
> - #67: la pantalla "Mi agenda" del profesor (T-26). Incluye:
>   - `agenda-propia.ts`, con las vistas día y semana, los rangos y el agrupado por fecha, más sus tests;
>   - los componentes `AgendaPropiaListado`, `AgendaPropiaTable` y `SelectorVistaAgenda`;
>   - `NavegacionFecha`, generalizado con `textos` y `esActual`;
>   - el hook `useAgendaPropia` y la key `turnosKeys.agendaPropia`.
>
> **Por qué igual hace falta backend:** `GET /turnos/agenda?profesorId=` (T-42) devuelve un solo día y viene paginado, y `agenda-propia` saca el profesor de la sesión y es solo del rol `PROFESOR`. Se suma un endpoint para `MESA_ENTRADAS` que reutiliza la misma lógica. El frontend, en cambio, **reutiliza casi todo lo de "Mi agenda"**.
>
> **Dos prompts en la misma sesión y en la rama actual** (`feat/turnos-profesor`, que hoy está igual a `testing`), en un solo PR. Pegá el 2 recién cuando el 1 termine en verde.
>
> ```bash
> git switch feat/turnos-profesor && git pull origin testing
> pnpm install && pnpm db:generate && pnpm check   # línea de base en verde
> ```

---

## Prompt 1: API de la agenda de un profesor para mesa de entradas

Estamos en la rama `feat/turnos-profesor`. Vas a sumar a la API la agenda de **un profesor cualquiera en un rango de fechas**, para `MESA_ENTRADAS`. La va a usar la ficha del profesor (HU-02 pide ver "su horario de atención junto con su agenda") con una vista semanal. Trabajá como backend senior: reutilizá, no dupliques reglas, y respetá `AGENTS.md`, `CLAUDE.md` y `.claude/rules/backend.md`.

### 0. Qué existe y qué se reutiliza

- `GET /api/v1/turnos/agenda-propia?desde&hasta` (T-25, decisión T-43), en `src/server/features/turnos/`: `agendaPropiaQuerySchema`, `agendaPropiaItemSchema`, `validarRangoAgenda`, `MAX_DIAS_AGENDA`, `repository.listarAgendaPropia({ profesorId, desde, hasta })` y `expandirOcurrencias` de `turnos.reglas.ts`. El único dato propio del rol `PROFESOR` es de dónde sale el `profesorId` (del `Actor`). Todo lo demás es exactamente lo que necesitamos.
- `GET /api/v1/turnos/agenda?profesorId=` (T-42) **no se toca**: es la agenda diaria del centro, un solo día y paginada.

### 1. Leer antes de escribir código

1. `docs/arquitectura-backend.md`, `docs/convenciones-backend.md` (Paginación, Filtros y respuestas, condiciones de turnos) y `docs/contrato-api.md` → Turnos → "Agenda propia del profesor".
2. `docs/decisiones.md` → T-35, T-42 y T-43.
3. Todo `src/server/features/turnos/` y sus `__tests__/`, en especial lo del commit `4cf7846` ("backend de agenda de profesor propia", #65), que es el precedente directo.
4. `src/server/features/profesores/profesores.repository.ts`: buscá un método que diga si un profesor existe. Es la única dependencia permitida entre features.
5. Solo para saber quién consume la forma de la respuesta: `src/features/turnos/turnos.types.ts` → `AgendaPropiaItem`. El endpoint nuevo tiene que devolver **exactamente esa forma**, porque el frontend va a reutilizar ese tipo.

Después, **presentame un plan corto** (archivos, firma del service, errores) antes de escribir código.

### 2. Endpoint

**`GET /api/v1/turnos/agenda-profesor?profesorId&desde&hasta`**, con rol `MESA_ENTRADAS` y solo lectura.

- `profesorId` es **obligatorio**. `desde` y `hasta` funcionan igual que en `agenda-propia`: sin `desde`, hoy; sin `hasta`, el mismo día que `desde`; con el mismo tope de `MAX_DIAS_AGENDA`.
- La respuesta tiene **la misma forma** que `agenda-propia`: un arreglo sin paginar de ocurrencias (`turnoId` + `fecha`), en el mismo orden, sin cancelados y sin datos del profesor (ya viene fijo). Reutilizá `agendaPropiaListadoSchema` y **no inventes un segundo schema con la misma forma**. Si el nombre "Propia" confunde en la doc de OpenAPI, sumá un comentario. No lo renombres en este PR: es código de otro compañero y no hace falta.
- Un profesor **inactivo** también se puede consultar: la ficha es de solo lectura y sus turnos históricos siguen existiendo.
- Errores:
  - 400 `VALIDACION`: los mismos que `agenda-propia` y además `profesorId` faltante o inválido.
  - 404 `NO_ENCONTRADO`: el profesor no existe.
  - 403: cualquier rol que no sea `MESA_ENTRADAS`.

El nombre y la ruta quedan en `turnos` (no en `/profesores/{id}/agenda`) porque la lógica es de turnos y entre features solo se permite importar repositories. Si ves una razón fuerte para otra forma, **frená y consultame** antes de implementarla.

### 3. Service sin duplicar

Extraé el cuerpo común de `listarAgendaPropia` a una función privada del service, por ejemplo `agendaDeProfesor(profesorId, desde?, hasta?)`, que:

- resuelve los defaults de las fechas;
- corre `validarRangoAgenda`;
- llama a `listarAgendaPropia` del repository;
- expande con `expandirOcurrencias`;
- mapea al ítem.

Después:

- `listarAgendaPropia(query, actor)` resuelve el id con `buscarIdPorUsuario` y la llama. **Su comportamiento no cambia.** Los tests actuales tienen que seguir pasando sin tocarlos, salvo imports.
- `listarAgendaDeProfesor(query)` verifica que el profesor exista (404) y la llama.

Si el método del repository se llama "Propia" y ahora lo usan los dos, podés renombrarlo a algo neutro (`listarAgendaDeProfesor`) en este PR. Solo si el cambio queda chico. Contámelo en el resumen.

### 4. Tests

Seguí el patrón de los tests de `agenda-propia`:

- **service:**
  - devuelve las ocurrencias del profesor pedido;
  - 404 si no existe;
  - funciona con un profesor inactivo;
  - aplica los defaults de fechas y los errores de rango.
- **routes:**
  - 200 con `MESA_ENTRADAS`;
  - 403 con `PROFESOR`;
  - 400 sin `profesorId` o con un rango de más de `MAX_DIAS_AGENDA`.
- Que `agenda-propia` siga igual (ya está cubierto: no lo rompas).

### 5. Documentación (mismo PR, regla 9)

- **`docs/contrato-api.md` → Turnos:**
  - Actualizá la línea "Todos los endpoints son de `MESA_ENTRADAS`, salvo…".
  - Sumá la subsección "Agenda de un profesor (mesa de entradas)", que remita a la forma de "Agenda propia" en vez de repetir el JSON.
  - En la tabla de Filtros, que `desde`/`hasta` digan que también aplican acá.
- **`docs/convenciones-backend.md`:** donde nombra la agenda propia como listado sin paginar y como rango de fechas, sumá este endpoint.
- **`docs/decisiones.md`:** una decisión nueva con el **próximo número libre** (hoy sería T-44), que diga:
  - `agenda-profesor` es para mesa y reutiliza la lógica y la forma de T-43;
  - existe porque la ficha del profesor (HU-02) muestra la agenda semanal y `/turnos/agenda` es por día y paginada;
  - un profesor inactivo se puede consultar.

  Respetá el ancho de las columnas de la tabla.

- `turnos.ejemplos.ts`: reutilizá `ejemploAgendaPropia` en el `example` de la ruta.

### 6. Al terminar

1. `pnpm check` y reportá el **resultado real**.
2. `/revisar-arquitectura` y corregí lo que marque.
3. **No commitees, no crees ramas, no corras migraciones.** No hace falta tocar `schema.prisma`.
4. Resumen: archivos tocados, la firma final del endpoint, lo que renombraste (si renombraste algo) y un `curl` de ejemplo para probarlo con `pnpm dev`.

---

## Prompt 2: pestaña "Agenda" en la ficha del profesor, reutilizando "Mi agenda"

Seguimos en la misma rama. Vas a sumar a la ficha del profesor (`/mesa/profesores/[profesorId]`) una **cuarta pestaña, "Agenda"**, con la agenda del profesor. La HU-02 pide que el detalle muestre sus datos, sus materias, su horario de atención y su agenda. La API es la del prompt anterior: `GET /api/v1/turnos/agenda-profesor?profesorId&desde&hasta`. Trabajá como frontend senior y respetá `AGENTS.md`, `CLAUDE.md` y `.claude/rules/frontend.md`.

### 0. Lo principal: esto ya está hecho casi entero en "Mi agenda"

La pantalla del profesor (T-26, #67) ya resuelve todo el problema: vista por día y por semana, el rango en la URL, la navegación, el agrupado por fecha, la tabla, los estados de carga y de error, y los tests de la lógica pura. La ficha tiene que verse y comportarse **igual**, con la misma tabla, el mismo selector Día/Semana y la misma navegación. Solo cambian cuatro cosas:

1. **De dónde salen los datos:** `agenda-profesor` con `profesorId`, en lugar de `agenda-propia`.
2. **Dónde vive la URL:** dentro de la ficha. Hay que **conservar `?tab=agenda`** (hoy `AgendaPropiaListado` arma la URL desde cero con `RUTA`, así que perdería el tab).
3. **La vista por defecto:** en la ficha es **semana**; en "Mi agenda" sigue siendo **día**.
4. **Los mensajes de error:** el 404 de "Mi agenda" ("Tu usuario no tiene una ficha de profesor…") no aplica en la ficha. Ahí un 404 es "Profesor no encontrado".

**No dupliques** `AgendaPropiaListado` ni `AgendaPropiaTable`. Refactorizá lo mínimo para que sirvan a las dos pantallas y **"Mi agenda" no cambie en nada** para el profesor: ni la URL, ni la vista por defecto, ni los textos, ni el comportamiento.

**Recomendación de diseño** (si ves una mejor, proponela en el plan):

- **Un componente controlado para la parte visual**, por ejemplo `AgendaPorRango`. Arma la navegación, el selector, la tabla, el error y el pie. Recibe:
  - `vista` y `fecha`;
  - los callbacks para cambiarlas;
  - el estado de la query (`data`, `isLoading`, `isFetching`, `error`, `refetch`);
  - un `mensajeError(error)`.

  **No conoce el endpoint.**

- **Un hook para el estado en la URL**, por ejemplo `useRangoAgendaEnUrl({ vistaPorDefecto })`. Lee y escribe `vista` y `fecha` con `router.replace` sobre el **pathname actual**, conservando el resto de los parámetros (`tab`). Omite los valores por defecto, como ya lo hace hoy "Mi agenda".
- **Dos contenedores finos:**
  - `AgendaPropiaListado` queda con `useAgendaPropia(rango)`;
  - `AgendaProfesorListado({ profesorId })` es nuevo y usa `useAgendaProfesor({ profesorId, ...rango })`.
- `AgendaPropiaTable` ya no tiene nada de "propia": muestra ocurrencias sin profesor. Reutilizala tal cual. **No renombres** archivos ni tipos (`AgendaPropiaItem`, `agenda-propia.ts`) en este PR, porque el diff crecería sin aportar nada. Si algún comentario o texto ("Turnos propios…", "tu agenda") queda mal en la ficha, ajustá solo ese texto o pasalo por prop.

`normalizarFecha`, `parsearVista` y compañía ya están probadas. Si `parsearVista` necesita recibir la vista por defecto, agregale el parámetro (con `'dia'` como default, así "Mi agenda" no cambia) y **sumá el test**.

### 1. Restricción de arquitectura

`features/profesores` **solo puede importar hooks** de otra feature, nunca componentes (`docs/arquitectura-frontend.md` → Quién importa a quién). Por eso la agenda de la ficha se arma en `features/turnos` y se **compone desde `app/`**:

- `ProfesorDetalle` suma `'agenda'` a `TABS` (con el trigger "Agenda" y un ícono de lucide) y recibe una prop nueva, por ejemplo `renderAgenda: (profesor) => ReactNode`, que muestra dentro de `TabsContent value="agenda"`.
- `src/app/mesa/profesores/[profesorId]/page.tsx` importa `AgendaProfesorListado` de `features/turnos` y la pasa. `app/` puede importar de cualquier feature.

No muevas componentes de turnos a `components/ui/` para saltear la regla.

### 2. Leer antes de escribir código

1. **Todo lo de #67** (`git show fd49c42`):
   - `agenda-propia.ts` y su test;
   - `AgendaPropiaListado`, `AgendaPropiaTable`, `AgendaPropiaPantalla` y `SelectorVistaAgenda`;
   - `NavegacionFecha`;
   - `use-agenda-propia.ts`, `turnos.api.ts`, `turnos.keys.ts` y `turnos.types.ts`.
2. `features/profesores/components/ProfesorDetalle.tsx` y `HorarioProfesor.tsx`, para ver cómo un tab usa sus propios parámetros sin pisar `tab`.
3. `docs/arquitectura-frontend.md`: Quién importa a quién, **Tab del detalle y formularios de una sección**, Query keys e invalidación, y Fechas y horas.
4. `docs/contrato-api.md` → Turnos → la sección nueva del prompt 1.

Después, **presentame un plan corto** antes de escribir código: qué refactorizás de "Mi agenda", qué creás, los parámetros de la URL y cómo verificás que "Mi agenda" no cambió.

### 3. Capa de datos

- **API:** `listarAgendaProfesor({ profesorId, desde, hasta })`, que devuelve `AgendaPropiaItem[]`.
- **Keys:** `turnosKeys.agendasProfesor()` y `agendaProfesor(params)`, **colgando de `all`**, para que registrar un turno ya invalide esta vista.
- **Hook:** `useAgendaProfesor(params)`, con la misma configuración que `useAgendaPropia` (`keepPreviousData` y no reintentar los 4xx). Si queda idéntico salvo la `queryFn` y la key, está bien que sean dos hooks cortos: no hace falta abstraerlos.
- **Tipo de params:** `AgendaProfesorParams = AgendaPropiaParams & { profesorId: number }`.

### 4. URL de la ficha

- Formato: `?tab=agenda&vista=dia&fecha=2026-09-28`. Sin `vista`, es semana. Sin `fecha`, el rango actual. La fecha va normalizada con `normalizarFecha`, como en "Mi agenda".
- Cambiar de semana o de vista usa `router.replace` con `scroll: false` y **conserva `tab=agenda`**.
- Cambiar de tab en `ProfesorDetalle` ya descarta los otros parámetros. Está bien: al volver a la pestaña, se ve la semana actual.
- `ProfesorDetalle` ya lee la URL dentro de `<Suspense>`: verificá que siga así.
- Un profesor **inactivo** también muestra su agenda, en modo solo lectura.

### 5. Criterios de aceptación

Verificalos a mano con `pnpm services:up`, `pnpm db:seed` y `pnpm dev`:

- La ficha tiene cuatro tabs: Datos, Materias, Horario de atención y **Agenda**. Entrar por URL con `?tab=agenda` abre la agenda **en la semana actual**.
- Un turno recurrente aparece en cada semana de su rango. Una sesión única aparece solo en su fecha. Los días de la semana se ven agrupados como en "Mi agenda".
- Anterior, siguiente, el salto por fecha, "Esta semana"/"Hoy" y el cambio Día/Semana funcionan, y **nunca se pierde `tab=agenda`**. Recargar conserva lo que se estaba viendo. Una `fecha` o una `vista` con basura caen en el rango por defecto.
- Registrar un turno para ese profesor en `/mesa/turnos` y volver a la ficha lo muestra sin recargar.
- **"Mi agenda" (`/profesor/agenda`) sigue igual:** la vista por defecto es día, la URL tiene el mismo formato, los textos y el 404 son los mismos, y sus tests pasan sin cambios en lo que ya cubrían.
- La agenda diaria (`/mesa/agenda`) sigue igual.
- Mobile: no hay scroll horizontal de la página.

Pasame los datos que usaste para probar. Si el seed no alcanza, contame qué cargaste a mano. **No toques el seed.**

### 6. Documentación (mismo PR)

- **`docs/arquitectura-frontend.md`:**
  - la ficha del profesor tiene el tab `agenda` (`?tab=agenda&vista&fecha`, semana por defecto);
  - el patrón de componer desde `app/` un componente de otra feature en un tab (`renderAgenda`);
  - que las dos agendas por rango comparten el componente y el hook de URL;
  - el árbol de Estructura, con los archivos nuevos o renombrados.
- **`docs/sprints/sprint-1.md` → T-08 (HU-02):** una "Actualización (agenda en la ficha)" **sin borrar** el texto original. Tiene que decir que la ficha suma la agenda del profesor a pedido de los PO, que usa `GET /turnos/agenda-profesor` y que reutiliza la vista de T-26.

### 7. Al terminar

1. `pnpm check` y reportá el **resultado real**.
2. `/revisar-arquitectura` y corregí lo que marque.
3. **No commitees, no crees ramas.**
4. Resumen con:
   - los archivos tocados, separados por `turnos`, `profesores` y `app`;
   - lo que refactorizaste de "Mi agenda" y cómo verificaste que no cambió;
   - las decisiones que tomaste y no estaban acá;
   - los pasos de verificación manual.
