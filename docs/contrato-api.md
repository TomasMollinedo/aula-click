# Contrato de la API — Aula Click

Lo que el frontend y el backend acuerdan. Es el único documento que los dos lados necesitan leer para hablarse. El detalle de cada endpoint (paths, campos, status codes) está en el OpenAPI: Swagger UI en `/api/v1/docs` y JSON en `/api/v1/openapi.json`.

Si algo de este archivo cambia, se avisa al otro lado y se actualiza acá en el mismo PR (`AGENTS.md`, regla 9).

## URLs

| Prefijo         | Qué es                              | Quién lo llama desde el frontend                      |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| `/api/v1/...`   | API de negocio (Hono + OpenAPI)     | Solo `fetchJson`, desde `src/features/<entidad>/api/` |
| `/api/auth/...` | Better Auth: login, logout y sesión | Solo el `authClient` de `src/features/auth/`          |

Todo es mismo origen: la sesión viaja en una cookie y no hay tokens que manejar a mano.

## Idioma y nombres

- Rutas, campos JSON, valores de enums y códigos de error en español (`/api/v1/alumnos`, `materiaId`, `ACTIVO`, `BLOQUE_LLENO`).
- Los campos JSON van en camelCase.
- `message` en los errores es un texto en español apto para mostrar al usuario.

## Formatos

| Dato                                           | Formato en la API                                                        | Ejemplo                    |
| ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| Fecha de calendario                            | string `YYYY-MM-DD`                                                      | `2026-09-22`               |
| Hora                                           | string `HH:mm` (00:00 a 23:59)                                           | `09:30`                    |
| Día de la semana                               | entero ISO: 1 = lunes … 7 = domingo                                      | `3`                        |
| Instante (auditoría: `createdAt`, `updatedAt`) | string ISO 8601 en UTC                                                   | `2026-09-22T13:45:00.000Z` |
| DNI                                            | se devuelve solo con dígitos; en la entrada se aceptan puntos y espacios | `30123456`                 |
| Email                                          | se guarda en minúsculas y sin espacios alrededor                         | `ana.perez@mail.com`       |
| Teléfono                                       | se devuelve tal como lo escribió el usuario                              | `(387) 15-412-3456`        |

La zona horaria del negocio es `America/Argentina/Salta`. Qué fecha es "hoy" para las reglas (vigencia, prioridad) lo decide la API.

## Listados paginados

Query: `page` (entero >= 1, default 1) y `pageSize` (entero de 1 a 100, default 20).

Respuesta:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
}
```

- `totalPages` es 0 cuando no hay resultados.
- Se pagina todo listado de entidades. **No** se paginan los selectores de catálogo (por ejemplo materias activas para un dropdown) ni la agenda diaria, que se filtra por fecha: esos devuelven un arreglo.
- En el frontend, el tipo de la respuesta es `PaginatedResponse<T>` de `src/types/index.ts`, que debe coincidir exactamente con esta forma.

## Filtros

Nombres fijos de query (un filtro nuevo se agrega a esta lista):

| Query       | Qué hace                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `q`         | Búsqueda por texto. No distingue mayúsculas ni tildes (`gonzalez` encuentra a "González")              |
| `estado`    | `ACTIVO` o `INACTIVO`. Solo en entidades con baja lógica (profesores y materias); por defecto `ACTIVO` |
| `materiaId` | Filtra por materia                                                                                     |

## Recursos individuales

- Se devuelven directo, **sin** envoltorio `{ data }`.
- El detalle de una entidad incluye quién la creó y quién la modificó por última vez (nombre y fecha/hora). La forma exacta está en el OpenAPI.

## Errores

Todo error responde con este cuerpo (`details` es opcional):

```json
{
  "error": {
    "code": "CONFLICTO",
    "message": "DNI ya registrado",
    "details": {}
  }
}
```

| Status | `code` por defecto | Clase en el backend              | Cuándo                                                                                                     |
| ------ | ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDACION`       | `ValidationError`                | Entrada inválida. `details` trae las issues de Zod (cada una con `path` y `message`)                       |
| 401    | `NO_AUTENTICADO`   | `UnauthorizedError`              | No hay sesión o la sesión no es válida                                                                     |
| 403    | `SIN_PERMISO`      | `ForbiddenError`                 | El rol no alcanza para el endpoint, o el usuario no tiene rol                                              |
| 404    | `NO_ENCONTRADO`    | `NotFoundError`                  | El recurso no existe, o la ruta de `/api/v1` no existe                                                     |
| 409    | `CONFLICTO`        | `ConflictError`                  | Conflicto con el estado actual (DNI duplicado, solapamiento de turno, turnos vigentes que impiden la baja) |
| 500    | `ERROR_INTERNO`    | `AppError` o error no controlado | Error inesperado; no expone detalles                                                                       |

Códigos específicos (reemplazan al `code` por defecto; uno nuevo se agrega acá):

| Status | `code`         | `details`                                       |
| ------ | -------------- | ----------------------------------------------- |
| 409    | `BLOQUE_LLENO` | Lista de fechas en las que el bloque está lleno |

Qué hace la UI con cada caso está en `arquitectura-frontend.md` → Manejo de errores en la UI.

## Roles

Valores del campo `role` de la sesión: `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO`. Un usuario tiene un solo rol.

| Valor           | Rol              |
| --------------- | ---------------- |
| `MESA_ENTRADAS` | Mesa de entradas |
| `PROFESOR`      | Profesor         |
| `GERENTE`       | Gerente          |
| `ALUMNO`        | Alumno           |

- Base de datos: catálogo `rol` (lo carga el seed); `Usuario.role` es un FK a él.
- Backend: `ROLES` en `src/server/shared/actor.ts` (**A construir**).
- Frontend: el tipo `Role` de `src/types/index.ts`.

Los dos lados no pueden compartir código, así que un rol nuevo o un cambio de valor se hace en el seed, en `actor.ts` y en `src/types/index.ts` en el mismo PR.

## Autenticación

- Login con email y contraseña contra `/api/auth/...`, siempre a través del `authClient`.
- No hay registro público: los usuarios los crea un gerente. Hasta que se active `disableSignUp` (**A construir**), el endpoint de registro existe, pero el frontend no lo usa ni tiene pantalla de registro.
- Los endpoints de `/api/v1` responden 401 sin sesión válida y 403 si el rol no alcanza (ver tabla de errores).
