Vamos a implementar la tarea **T-04 · [Front] HU-00 · Login, cierre de sesión y layout por rol**. Ya estoy parado en la rama `feat/auth-ui`. No crees ramas ni hagas commits (`AGENTS.md`, regla 10). No hace falta ninguna dependencia nueva (`better-auth/react` ya viene dentro del paquete `better-auth`), así que no toques `package.json`.

## Contexto: esta tarea corre en paralelo a T-03, sin esperarla

T-03 (`feat/auth-api`, [#4](https://github.com/TomasMollinedo/aula-click/issues/4)) es la tarea de backend de la que depende ésta, y la está haciendo un compañero en otra rama, en paralelo. La idea es no bloquearnos esperándola: construimos el frontend contra el **contrato documentado** (`docs/contrato-api.md`, `docs/arquitectura-backend.md` → Autenticación, `docs/dominio.md`), no contra el código de la rama `feat/auth-api` (no la leas ni intentes mezclarla). No va a quedar perfecto al 100% — es un trade-off consciente para ganar tiempo — pero tiene que quedar fácil de unificar cuando T-03 se mergee.

**Antes de escribir código**, verificá el estado real de `main` por si algo de T-03 ya se mergeó desde que se escribió este prompt (`git log`, y mirá si `docs/contrato-api.md` o `src/lib/auth.ts` cambiaron respecto a lo que se describe más abajo). Si ya está, usá lo real en vez de las suposiciones de este prompt.

## Ya hecho fuera de esta tarea — no rehacer

Ya en `main`, por haberse detectado que el código contradecía la decisión T-19 (segmentos reales de URL, sin route groups):

- `src/app/(personal-mesa-entradas)/` → `src/app/mesa/`
- `components/layout/personal-mesa-entradas-sidebar.tsx` → `mesa-sidebar.tsx` (componente `MesaSidebar`)
- `href` del sidebar y del link "Nuevo alumno" → `/mesa/...`

No lo toques salvo lo que se pide explícitamente más abajo (que `MesaLayout` pase a usar `AppShell`).

## Leer antes de escribir código

- `AGENTS.md` y `CLAUDE.md`.
- `docs/arquitectura-frontend.md` completo (carpetas, roles y URLs, layout, autenticación en el cliente, manejo de errores).
- `docs/contrato-api.md` → Roles, Autenticación, Errores.
- `docs/dominio.md` → Roles.
- `docs/decisiones.md` → T-19, T-14 (y lo que haya alrededor de D-06, ya resuelto en T-19).
- `docs/arquitectura-backend.md` → sección "Autenticación y autorización" (para saber qué va a hacer la API aunque T-03 no esté mergeada todavía).
- `src/lib/auth.ts` tal como está hoy en `main`: fijate que `additionalFields` (`role`, `apellido`, `dni`, `busqueda`, `telefono`, `estado`) ya están — eso es de T-01, no de T-03, así que no es parte del riesgo de integración.
- `src/types/index.ts`, `src/app/providers.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`.
- `src/app/mesa/layout.tsx` y `components/layout/mesa-sidebar.tsx` (patrón ya migrado; `app/profesor/` lo replica).
- `src/proxy.ts` — para entender qué protege hoy. **No lo edites**: es de T-03 (ver "Riesgos" y "Fuera de esta tarea").
- En `node_modules`, la versión instalada de `better-auth` (1.7.5): API real de `createAuthClient`, del plugin `inferAdditionalFields` y de los errores que devuelve `authClient.signIn.email(...)` (status/code). No asumas de memoria.

## Decisiones ya tomadas (no las vuelvas a discutir)

1. Segmentos de URL por rol sin route groups (T-19): `/mesa` ya migrado; falta `/profesor`. `/gerente` y `/portal` no se crean en este sprint.
2. El rol que ve el frontend no es seguridad: el layout de un segmento no valida sesión ni rol como si lo fuera (`arquitectura-frontend.md`).
3. No hay pantalla de registro ni recuperación de contraseña (fuera de alcance según la HU).
4. Tests de frontend: decisión abierta D-09. No agregues tests automatizados de frontend para esta tarea; los automatizados siguen cubriendo solo backend.

## Riesgo de integración con T-03 — leer con atención

El único punto realmente acoplado a cómo implemente T-03 es **distinguir** "credenciales incorrectas" (mensaje: "Usuario o contraseña incorrectos") de "profesor inactivo" (mensaje: "Su usuario no está habilitado"). Hoy `docs/contrato-api.md` todavía no documenta el código de error nuevo para ese segundo caso (lo agrega T-03).

Manejalo así:

- Aislá esa lógica en un solo lugar chico (por ejemplo una función `interpretarErrorLogin(error)` dentro de la feature `auth`), no repartida en el componente.
- Por defecto, cualquier error de `authClient.signIn.email(...)` muestra "Usuario o contraseña incorrectos".
- Dejá un comentario `// TODO(T-03): distinguir profesor inactivo cuando se mergee feat/auth-api — ver docs/contrato-api.md` en el punto exacto donde haría falta la distinción.
- Si al momento de correr este prompt ya podés ver el código/mensaje real (porque T-03 se mergeó mientras tanto), implementá la distinción real en vez del TODO.
- No inventes vos un código de error ni la regla de "profesor inactivo": esa regla la decide y la hace cumplir la API (`dominio.md`), no el frontend.

## Alcance

### 1. `features/auth/`

- `auth-client.ts`: `createAuthClient` de `better-auth/react` + el plugin `inferAdditionalFields` con los mismos `additionalFields` que hoy declara `src/lib/auth.ts` (al menos `role`; sumá `apellido`, `dni`, `telefono`, `estado` si hace falta para tipar lo que se consume — `busqueda` tiene `returned: false` en el server, confirmá si corresponde declararla igual del lado del cliente o si se puede omitir). No importés `@/lib/auth` (ESLint lo bloquea): se redeclara del lado del cliente. Exportá `authClient` de forma que `session.user.role` salga tipado sin `cast`.
- `roles.ts`: única correspondencia rol → segmento de URL (`arquitectura-frontend.md`): `MESA_ENTRADAS → /mesa`, `PROFESOR → /profesor`. Para `GERENTE` y `ALUMNO`, a tu criterio dejarlos afuera o preparados sin página — si los dejás, comentá por qué (no se crean sus segmentos en este sprint).
- `components/LoginForm.tsx`: email y contraseña obligatorios, contraseña enmascarada. Llama a `authClient.signIn.email`, maneja estado de carga y de error con `interpretarErrorLogin`. Login exitoso → redirige (Client Component, `useRouter` de `next/navigation`) al segmento de `roles.ts[role]`.
- `components/UserMenu.tsx`: nombre del usuario (de `authClient.useSession()`) + botón "Cerrar sesión" (`authClient.signOut()`, redirige a `/login`). Esto no está nombrado literalmente en el texto de la tarea, pero lo pide `arquitectura-frontend.md` (Header necesita el menú de usuario por props) y hace falta para el punto 5. Marcalo en tu resumen final como algo que agregaste más allá del texto literal de la tarea.

### 2. `/login` (`src/app/login/page.tsx`)

Ya está fuera de los layouts de rol. Usa `LoginForm`. Sin pantalla de registro. Si se llega acá por la redirección del punto 6 (401 / sesión vencida), mostrar el aviso "Tu sesión expiró" — definí el mecanismo (por ejemplo `?motivo=sesion_expirada` leído con `useSearchParams` en un Client Component) y usalo también desde el punto 6.

### 3. `app/profesor/`

Crear `layout.tsx` (mismo patrón que `app/mesa/layout.tsx`, pero montando `AppShell` — ver punto 5) y dos páginas placeholder con su título, análogas a como están hoy `app/mesa/materias/page.tsx` o `app/mesa/turnos/page.tsx`: "Mi agenda" y "Mis alumnos". Elegí slugs simples, en minúsculas y sin acentos, coherentes con el resto del proyecto (por ejemplo `agenda` y `alumnos`, o lo que te parezca más claro — decidilo y decí por qué).

### 4. Redirección por rol

- `src/app/page.tsx` pasa a Client Component: lee la sesión con `authClient.useSession()`; sin sesión, redirige a `/login`; con sesión, redirige a `roles.ts[role]`; mientras carga, mostrar algo mínimo.
- Si un usuario entra a un segmento que no es el suyo (por ejemplo un profesor entra a `/mesa/...`), redirigirlo al suyo. Es navegación, no seguridad (la seguridad la da la API). Implementalo donde tenga más sentido — lo más simple es comparar `session.user.role` contra el segmento en cada `layout.tsx` de rol (`app/mesa/layout.tsx`, `app/profesor/layout.tsx`); si preferís otra estructura (por ejemplo un componente compartido), documentala y justificala, pero que quede claro que no reemplaza el control real del backend.

### 5. `AppShell`, `header.tsx`, sidebar por rol

- `components/layout/app-shell.tsx`: recibe `sidebar` y `userMenu` por props (`arquitectura-frontend.md`); arma Header arriba, Sidebar al costado y el contenido.
- `components/layout/header.tsx`: logo + lugar para el `userMenu` recibido por props (no puede importar `features/`, así que el `UserMenu` armado le llega desde el layout del segmento).
- `components/layout/profesor-sidebar.tsx`: "Mi agenda", "Mis alumnos" (mismos slugs que definiste en el punto 3).
- `app/mesa/layout.tsx` y `app/profesor/layout.tsx` pasan a montar `<AppShell sidebar={<XSidebar />} userMenu={<UserMenu />}>{children}</AppShell>`. `MesaSidebar` no cambia sus links (ya apuntan a `/mesa/...`).
- `app/layout.tsx` (raíz) sigue montando solo `<Providers>`. No lo toques salvo que sea estrictamente necesario, y si lo hacés, decilo.

### 6. 401 centralizado en `providers.tsx`

Agregar `onError` en `QueryCache` y en `MutationCache` del `QueryClient`: ante un error 401, redirigir a `/login` con el mismo aviso "Tu sesión expiró" del punto 2. Hoy ninguna feature real usa `fetchJson` todavía (las features de API backend son esqueletos), así que este `onError` probablemente no dispara con nada real todavía — implementalo igual, correcto y bien tipado (usando el `ApiError` de `src/utils/fetch-json.ts`), listo para cuando existan queries y mutaciones reales.

### 7. `src/types/index.ts`

Confirmá que `Role` ya tiene los 4 valores del contrato (`MESA_ENTRADAS`, `PROFESOR`, `GERENTE`, `ALUMNO` — ya están, de T-01). Si hiciera falta tocarlo, decí exactamente qué cambiaste y por qué. Revisá también si `docs/arquitectura-frontend.md` → "Roles y URLs" quedó desactualizado por la migración de mesa (mención a route groups) y actualizalo si corresponde, en el mismo cambio (`AGENTS.md`, regla 9).

## Fuera de esta tarea — no tocar

- `src/proxy.ts`: es de T-03. Vas a notar que su `matcher` hoy está desactualizado (sigue apuntando a rutas viejas sin `/mesa`, y no cubre `/profesor`) — es un problema real, pero no es de esta tarea: dejalo mencionado en tu resumen final para que se avise, no lo corrijas vos acá.
- `src/server/**`, `src/lib/**` (backend): es de T-03.
- `app/gerente/`, `app/portal/`: no se crean en este sprint.
- Páginas de negocio ya existentes (`app/mesa/alumnos`, `materias`, `turnos`, `calendario`): no cambian más que heredar el nuevo `AppShell` a través del layout.

## Criterios de aceptación (de la tarea + de la HU)

- Cada usuario del seed ve solo el menú de su rol (mesa de entradas: Alumnos, Profesores, Materias, Turnos, Agenda diaria; profesor: Mi agenda, Mis alumnos).
- Login exige email y contraseña, contraseña enmascarada; credenciales incorrectas → "Usuario o contraseña incorrectos" sin indicar cuál campo falló.
- Profesor inactivo → "Su usuario no está habilitado" (con el TODO documentado si T-03 no está mergeada — ver "Riesgo de integración").
- Sin pantalla de registro ni de recuperación de contraseña.
- Cerrar sesión lleva a `/login`; el botón Atrás no deja volver a una pantalla con datos (comprobalo: si hace falta, es consecuencia de que `/login` no guarda nada en caché y de que las páginas con datos dependen de la sesión).
- Con la sesión vencida, cualquier acción redirige a `/login` con el aviso "Tu sesión expiró".
- Un usuario que entra a un segmento que no es el suyo termina en el suyo.

## Al terminar

1. Correr `pnpm check` (o al menos `pnpm typecheck` + `pnpm lint`) y reportar el resultado real.
2. Listar los archivos creados y modificados.
3. Marcar explícitamente qué quedó como supuesto o como TODO pendiente de T-03 — en particular el mensaje de "profesor inactivo" y cualquier otro punto donde asumiste algo del contrato que `docs/contrato-api.md` todavía no confirma.
4. Señalar qué agregaste más allá del texto literal de la tarea porque lo pedía `arquitectura-frontend.md` (por ejemplo `UserMenu.tsx`).
5. Recordar el problema de `src/proxy.ts` desactualizado, sin corregirlo.
6. No crear ramas ni commits (`AGENTS.md`, regla 10); dejar los cambios sin commitear.
7. Si algo no está claro o depende de una decisión abierta, decirlo en vez de suponerlo (`AGENTS.md`, regla 7).
