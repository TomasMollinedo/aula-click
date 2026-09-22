Vamos a **cerrar la tarea T-04 · [Front] HU-00** ahora que T-03 (`feat/auth-api`) ya está mergeada. Estoy parado en la rama `feat/auth-ui`, que ya tiene el merge de `main` con T-03 adentro. No crees ramas ni hagas commits (`AGENTS.md`, regla 10). No hacen falta dependencias nuevas: no toques `package.json`.

El grueso de T-04 ya está implementado (login, `AppShell`, sidebars, `/profesor`, redirección por rol, 401 centralizado). Lo que falta son **dos puntos que quedaron atados a T-03** y que ahora sí se pueden resolver, porque el contrato ya está cerrado y documentado.

## Contexto: qué cambió con T-03

T-03 definió el comportamiento de autenticación y lo dejó documentado en `docs/contrato-api.md` → Autenticación. Lo que importa para el frontend:

- `/api/auth/*` responde con el **formato de Better Auth** (`{ code, message }`), no con el `{ error: { … } }` de `/api/v1`. El `authClient` lo expone como `error.code` / `error.message` y el `message` viene **en inglés**.
- Códigos del login (`POST /api/auth/sign-in/email`): `401 INVALID_EMAIL_OR_PASSWORD` (email inexistente o contraseña incorrecta, siempre el mismo) y `403 USUARIO_INHABILITADO` (contraseña correcta pero el usuario está inactivo).
- En `/api/v1`, un usuario dado de baja **con la sesión abierta** recibe `403 USUARIO_INHABILITADO` (lo lanza `requireAuth()` en `src/server/middlewares/auth.ts`).
- La sesión vence por inactividad (60 min, decisión T-24) y se renueva sola con el uso. `rememberMe` no cambia nada: el servidor lo neutraliza (`forzarRecordarSesion` en `src/lib/auth-reglas.ts`).

`docs/arquitectura-frontend.md` **ya está actualizado y deduplicado** con todo esto (tenía dos tablas de errores pegadas por el merge; ya se arreglaron). Es la referencia de esta tarea: leelo antes de escribir código y no vuelvas a duplicar secciones. Si tu cambio modifica algo de lo que ahí dice, actualizalo en el mismo cambio (`AGENTS.md`, regla 9).

## Leer antes de escribir código

- `docs/arquitectura-frontend.md` → "Manejo de errores en la UI" y "Autenticación en el cliente".
- `docs/contrato-api.md` → Errores y Autenticación.
- `src/features/auth/` completo: `interpretar-error-login.ts`, `sesion-expirada.ts`, `auth-client.ts`, `roles.ts` y `components/`.
- `src/app/providers.tsx` y `src/utils/fetch-json.ts` (`ApiError` tiene `status`, `code` y `details`).
- `src/lib/auth-reglas.ts` y `src/server/middlewares/auth.ts`: son del backend y **no se tocan**, pero muestran exactamente qué código y qué mensaje se emiten.
- En `node_modules/better-auth`: **verificá en el código instalado**, no de memoria, qué forma exacta tiene el objeto `error` que devuelve `authClient.signIn.email(...)` (si `code` llega siempre, cómo se propaga el body del 403 que lanza `APIError.from('FORBIDDEN', …)`, y qué trae `status`). Si lo que encontrás contradice este prompt, frená y avisame antes de seguir.

## Punto 1 — `interpretar-error-login.ts`: elegir el texto por `code`

Hoy el archivo tiene un `TODO(T-03)` y devuelve siempre el mensaje de credenciales salvo en 5xx. Eso quedó de cuando T-03 no existía. Ahora:

- El texto se elige **por `code`**, no por status ni por el `message` en inglés (que nunca se muestra):
  - `INVALID_EMAIL_OR_PASSWORD` → "Usuario o contraseña incorrectos"
  - `USUARIO_INHABILITADO` → "Su usuario no está habilitado"
- Cualquier otro caso (5xx, error de red, un `code` desconocido) → el mensaje genérico que ya existe ("No se pudo iniciar sesión…"). Un `code` que no conocemos **no** se muestra como "credenciales incorrectas": sería mentirle al usuario.
- Sacá el `TODO(T-03)` y el comentario que dice que el código lo define T-03.
- Mantené la regla: un mensaje solo, que nunca revela qué campo falló ni si el email existe.
- Si te queda cómodo, importá el valor `USUARIO_INHABILITADO` en vez de repetir el string suelto — pero **no** desde `@/lib/auth-reglas` (ESLint bloquea `@/lib` desde el frontend, y con razón). Declaralo del lado del frontend como constante de la feature, con un comentario que diga que el valor lo fija el contrato (`contrato-api.md`).

**Test (opcional pero recomendado):** `interpretar-error-login.ts` es una función pura en `.ts`, así que un test suyo **no depende de D-09** (que es sobre tests de componentes con Testing Library y jsdom) ni necesita tocar `vitest.config.mts`, cuyo `include` ya es `src/**/*.test.ts`. Si lo agregás, cubrí los tres caminos (los dos `code` conocidos y el genérico) y decímelo en el resumen.

## Punto 2 — `providers.tsx`: manejar el 403 `USUARIO_INHABILITADO` junto al 401

Hoy `redirigirSiLaSesionExpiro` solo mira `error.status !== 401`. Falta el caso del usuario dado de baja con la sesión abierta, que `docs/arquitectura-frontend.md` ya describe.

- Ampliar la condición: dispara con **401** o con **403 cuyo `code` sea `USUARIO_INHABILITADO`**. Un 403 `SIN_PERMISO` **no** entra acá: eso lo muestra cada componente en el lugar del contenido, sin redirigir.
- En el caso `USUARIO_INHABILITADO` hay que **cerrar la sesión** antes de mandar a `/login` (`authClient.signOut()`): si la cookie sobrevive, el proxy lo deja entrar de nuevo y queda dando vueltas. Ojo con que `signOut()` es asíncrono y la función de `onError` hoy es sincrónica: resolvelo sin dejar una promesa colgada y sin que la redirección se adelante al cierre de sesión.
- El aviso que ve el usuario en `/login` es distinto según el motivo: "Tu sesión expiró…" para el 401 y "Su usuario no está habilitado" para el 403. Hoy `sesion-expirada.ts` tiene un solo motivo: agregá el segundo ahí, que es el único lugar que conoce esos nombres, y hacé que `AvisoSesionExpirada` muestre el texto que corresponda.
- Si al generalizarlo el nombre `AvisoSesionExpirada` (o el del archivo `sesion-expirada.ts`) deja de describir lo que hace, renombralo — pero entonces actualizá `docs/arquitectura-frontend.md`, que los menciona por nombre, en el mismo cambio. Si preferís no renombrar, dejalo y explicá por qué.
- Cuidado con el bucle: la guarda de "si ya estoy en `/login` no hago nada" tiene que seguir valiendo para los dos casos.

## Fuera de esta tarea — no tocar

- `src/lib/**`, `src/server/**`, `src/proxy.ts`: son de T-03 y ya están cerrados.
- `docs/contrato-api.md`: lo dejó T-03; solo se toca si encontrás que el frontend necesita algo que ahí no está, y en ese caso avisame antes.
- `app/gerente/`, `app/portal/`: no se crean en este sprint.
- Features de negocio (`alumnos`, `materias`, `profesores`, `turnos`): siguen como esqueletos.

## Verificación final de T-04 (revisá que siga cumpliéndose)

- Cada usuario del seed ve solo el menú de su rol; un usuario en el segmento de otro rol termina en el suyo (`SegmentoDeRol`).
- Credenciales incorrectas → "Usuario o contraseña incorrectos", sin decir qué campo falló.
- Profesor inactivo → "Su usuario no está habilitado", tanto al intentar entrar como si lo dan de baja con la sesión abierta.
- Cerrar sesión lleva a `/login` y el Atrás no muestra datos del usuario anterior (la cache de TanStack Query se vacía en `UserMenu`).
- Sesión vencida → cualquier acción lleva a `/login` con el aviso.

## Al terminar

1. Correr `pnpm check` y reportar el resultado real.
2. Listar los archivos creados y modificados.
3. Decir si renombraste `AvisoSesionExpirada` / `sesion-expirada.ts` y, si lo hiciste, confirmar que actualizaste `docs/arquitectura-frontend.md`.
4. Confirmar que ya no queda ningún `TODO(T-03)` ni supuesto pendiente en `src/features/auth/`.
5. Señalar cualquier diferencia que hayas encontrado entre lo que dice `docs/contrato-api.md` y lo que devuelve de verdad Better Auth en `node_modules`, en vez de acomodar el código a la suposición.
6. No crear ramas ni commits; dejar los cambios sin commitear.
