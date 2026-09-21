# Arquitectura del frontend — Aula Click

## El concepto: cada carpeta cumple una única función

| Carpeta                      | Función                                                                                                                                                       | No hace                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                       | Enrutar. Cada archivo define una URL o un layout que envuelve URLs.                                                                                           | No tiene lógica de negocio ni fetch propio — solo importa y compone lo de `features/`.                                                               |
| `features/`                  | Toda la lógica y UI de **una entidad del dominio** (alumno, profesor, turno...): sus tipos, su validación, sus llamadas a la API, sus hooks, sus componentes. | No conoce otras entidades salvo importando explícitamente su hook (ej. un form de turno usa `use-alumnos` de la feature `alumnos` para un selector). |
| `components/`                | Piezas de UI que **no pertenecen a ninguna entidad** — botones, inputs, el Sidebar.                                                                           | No importa nada de `features/`.                                                                                                                      |
| `hooks/`, `types/`, `utils/` | Utilidades genéricas que cualquier `features/*` o página puede usar (un hook de debounce, un tipo de paginación, un helper de clases CSS).                    | No contienen nada específico de una entidad — eso va adentro de la feature.                                                                          |
| `lib/`                       | Acceso a infraestructura de servidor: base de datos, sesión, almacenamiento de archivos.                                                                      | Es del backend. El frontend tiene prohibido importarlo (ver más abajo).                                                                              |
| `server/`                    | La API real, en capas (rutas, controller, service, repository, validación).                                                                                   | No la documenta este archivo — ver `arquitectura-backend.md`.                                                                                        |

Una página de `app/` importa de `features/` (su propia entidad) y de `components/` (UI compartida). Una feature importa de `hooks/`/`types/`/`utils/` (genéricos) y, si necesita datos de otra entidad, del hook de esa otra feature. Nadie del frontend importa `lib/` ni
`server/`.

## Roles

| Rol (nombre para textos y Sidebar) | Slug técnico (`route group`) |
| ---------------------------------- | ---------------------------- |
| Personal de mesa de entradas       | `(personal-mesa-entradas)`   |
| Profesor                           | `(profesor)`                 |
| Gerente                            | `(gerente)`                  |
| Alumno                             | `(portal)`                   |

## Estructura actual

```
src/
├── app/
│   ├── layout.tsx                      # root layout — envuelve TODO con <Providers>
│   ├── providers.tsx                   # QueryClientProvider (TanStack Query)
│   ├── page.tsx                        # landing, "/"
│   ├── login/page.tsx                  # sin sesión — fuera de cualquier route group
│   └── (personal-mesa-entradas)/
│       ├── layout.tsx                  # Sidebar de este rol — ver "(rol)/" más abajo
│       ├── alumnos/
│       │   ├── page.tsx                # listado
│       │   ├── nuevo/page.tsx          # alta
│       │   └── [alumnoId]/page.tsx     # edición
│       ├── profesores/page.tsx
│       ├── materias/page.tsx
│       ├── turnos/page.tsx
│       └── calendario/page.tsx
│
├── features/
│   └── alumnos/                        # única feature con carpeta creada hoy
│       ├── alumnos.types.ts
│       ├── alumnos.schema.ts
│       ├── api/{alumnos.api.ts, alumnos.keys.ts}
│       ├── hooks/{use-alumnos.ts, use-create-alumno.ts}
│       └── components/{AlumnosTable.tsx, AlumnoForm.tsx}
│
├── components/
│   ├── ui/            # vacío hoy (.gitkeep) — primitivos de UI sin decidir
│   └── layout/
│       └── personal-mesa-entradas-sidebar.tsx
│
├── hooks/use-debounce.ts
├── types/index.ts                      # PaginatedResponse<T>, Role
├── utils/{cn.ts, fetch-json.ts}
│
└── lib/                                 # server-only, del backend
    ├── prisma.ts, auth.ts, storage.ts
```

`features/alumnos/*` son la referencia de nombres de archivo y firmas de función a copiar
para cualquier otra entidad — ninguno tiene implementación todavía.

## `(rol)/`: solo layout, nunca seguridad

`app/(personal-mesa-entradas)/layout.tsx` agrupa páginas para compartir el Sidebar — no valida sesión ni rol ahí. La autorización real vive en `server/middlewares/auth.ts`
(`requireAuth`/`requireRole`, ver `arquitectura-backend.md`). `src/proxy.ts` solo redirige a
`/login` si no hay cookie de sesión.

Esta separación está forzada por una regla de ESLint (`eslint.config.mjs`, grupo
`serverFromFrontend`, aplicada a `src/app/**`, `src/components/**` y `src/features/**`):
ningún archivo del frontend puede importar `@/server/*`, `@/lib/auth` ni `@/lib/storage`.
Consecuencia práctica: cada componente que consuma datos maneja el error
(`isError`, `error.status`) con su propia UI — no asume que si la página cargó, el usuario
tiene permiso.

## Sidebar y Header

- **Sidebar** → uno por rol, en `components/layout/<rol>-sidebar.tsx`. Se monta en el `layout.tsx` de su propio route group. Cambia de rol a rol porque cada uno navega a pantallas distintas.
- **Header** → si hace falta uno (logo, menú de usuario), va en `components/layout/header.tsx`y se monta una sola vez en `app/layout.tsx` (el raíz) — es el mismo para todos los roles, a diferencia del Sidebar.

## `fetch-json.ts`: el contrato de error con el backend

`src/utils/fetch-json.ts` es el único lugar que interpreta la respuesta de error de la API
(`{ error: { code, message, details? } }`, ver `arquitectura-backend.md`) y la convierte en
un `ApiError` con `status`/`code`/`details`. Cualquier `<entidad>.api.ts` llama a
`fetchJson<T>(...)` en vez de repetir el parseo, y cualquier hook de TanStack Query se tipa
`useQuery<TData, ApiError>(...)` para tener `error.status`/`error.code` sin cast.

## Dependencias

Ver [`dependencias.md`](./dependencias.md).
