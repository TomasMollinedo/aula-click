import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

// Reglas de arquitectura. La fuente es AGENTS.md → "Reglas que hace cumplir ESLint":
// si se cambia algo acá, se actualiza esa tabla en el mismo PR.
//
// no-restricted-imports NO se acumula entre bloques: si dos bloques aplican al mismo archivo,
// gana el último. Por eso cada bloque declara todo lo suyo, y los bloques de "Imports por zona"
// están armados para que cada archivo caiga en uno solo.
//
// Imports relativos:
// - Dentro de una misma feature de API se importa con ruta relativa (./x.service, ../x.service
//   desde __tests__). Con alias (@/server/features/<misma>/...) la regla entre features lo toma
//   como si fuera otra feature.
// - Las reglas de frontend usan además un regex para atrapar imports relativos que salen de su
//   carpeta (../../server/...). Supone que dentro del frontend no hay carpetas llamadas server,
//   lib, config, generated, features ni components más que las de src/.
// - shared/ cierra también con regex las rutas relativas a features, lib/, config/ y generated/.
//   La regla la prueba src/server/shared/__tests__/eslint-limites.test.ts: si otro bloque la
//   pisa, ese test falla.

// dirs('@/x') → ['@/x', '@/x/*']: cubre el import de la carpeta y de todo lo que tiene adentro.
const dirs = (...names) => names.flatMap((name) => [name, `${name}/*`])

const prismaImports = {
  group: ['@/lib/prisma', '@/generated/*'],
  message: 'Solo el repository usa Prisma (@/lib/prisma, @/generated/*).',
}
const crossFeatureImports = {
  group: [
    '@/server/features/*/*.service',
    '@/server/features/*/*.controller',
    '@/server/features/*/*.routes',
    '../*/*.service',
    '../*/*.controller',
    '../*/*.routes',
    '../../*/*.service',
    '../../*/*.controller',
    '../../*/*.routes',
  ],
  message:
    'Una feature solo puede importar el repository de otra (lecturas). Dentro de la propia feature, usar imports relativos.',
}
// Fuera de los tests, de otra feature solo se importa su repository (lecturas) o sus condiciones
// (`<dominio>.condiciones.ts`: condiciones de consulta y lecturas para usar dentro de la
// transacción propia, T-39). Con alias o con ruta relativa que sale de la feature.
const soloRepositoryOCondiciones = 'repository|condiciones'
const otraFeatureMessage =
  'De otra feature solo se importa su repository o sus condiciones (*.repository, *.condiciones). Dentro de la propia feature, usar imports relativos.'
const otraFeatureSoloLecturas = [
  {
    regex: String.raw`^@/server/features/[^/]+/(?![^/]+\.(${soloRepositoryOCondiciones})$)[^/]+$`,
    message: otraFeatureMessage,
  },
  {
    regex: String.raw`^(\.\./)+[^./][^/]*/(?![^/]+\.(${soloRepositoryOCondiciones})$)[^/]+$`,
    message: otraFeatureMessage,
  },
]
// Un repository (o un archivo de condiciones) no importa el repository de otra feature: así el
// grafo de repositories no tiene ciclos. Lo que necesita de otra feature va en sus condiciones.
const repositoryDeOtraFeature = {
  group: ['@/server/features/*/*.repository', '../*/*.repository'],
  message:
    'Un repository no importa otro repository. Si necesita consultar datos de otra feature dentro de su transacción, usar sus *.condiciones.',
}
const sharedMessage =
  'shared/ no conoce a las features: son las features las que importan de shared.'
// Con alias, la carpeta entera o cualquier cosa adentro; relativo, desde cualquier profundidad
// de shared/ (../features/..., ../../features/...).
const featuresFromShared = [
  { group: dirs('@/server/features'), message: sharedMessage },
  { regex: '^(\\.\\./)+features(/|$)', message: sharedMessage },
]
// shared/ es código puro: nada de src/lib (Prisma, auth, storage), src/config ni el cliente
// generado, con alias ni con ruta relativa. Reemplaza a prismaImports en ese bloque (lo incluye).
const serverInfraMessage =
  'shared/ es código puro: no importa src/lib (Prisma, auth, storage), src/config ni src/generated.'
const serverInfraFromShared = [
  { group: dirs('@/lib', '@/config', '@/generated'), message: serverInfraMessage },
  { regex: '^(\\.\\./)+(lib|config|generated)(/|$)', message: serverInfraMessage },
]
const frontendFromBackend = {
  group: dirs('@/app', '@/features', '@/components', '@/hooks', '@/types', '@/utils'),
  message: 'El backend no importa código del frontend: se comunican solo por HTTP.',
}

const backendMessage =
  'El frontend consume la API por HTTP (fetchJson / authClient); no importa código de servidor.'
const backendFromFrontend = [
  { group: dirs('@/server', '@/lib', '@/config', '@/generated'), message: backendMessage },
  { regex: '^(\\.\\./)+(server|lib|config|generated)(/|$)', message: backendMessage },
]

const componentsMessage = 'components/ es UI sin entidad: no importa de features/.'
const featuresFromComponents = [
  { group: dirs('@/features'), message: componentsMessage },
  { regex: '^(\\.\\./)+features(/|$)', message: componentsMessage },
]

const genericMessage =
  'hooks/, types/ y utils/ son genéricos: no importan de features/ ni de components/.'
const uiFromGeneric = [
  { group: dirs('@/features', '@/components'), message: genericMessage },
  { regex: '^(\\.\\./)+(features|components)(/|$)', message: genericMessage },
]

const proxyMessage =
  'proxy.ts corre separado de la app: no importa módulos del proyecto (solo next/* y better-auth/*).'
const fromProxy = [
  { group: ['@/*'], message: proxyMessage },
  { regex: '^\\.', message: proxyMessage },
]

const openApiHonoImport = {
  name: '@hono/zod-openapi',
  importNames: ['OpenAPIHono'],
  message: 'Crear routers con createRouter() de @/server/router; no usar OpenAPIHono directamente.',
}

const restrict = ({ patterns = [], allowOpenApiHono = false } = {}) => [
  'error',
  {
    patterns,
    paths: allowOpenApiHono ? [] : [openApiHonoImport],
  },
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/generated/**',
  ]),

  // process.env solo en config/env.ts.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/config/env.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Leer variables de entorno solo desde @/config/env.',
        },
      ],
    },
  },

  // Base: OpenAPIHono prohibido en todo src/. Lo que no cae en ninguna zona de abajo queda así.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict() },
  },

  // ---------- Imports por zona (cada archivo cae en un solo bloque) ----------

  // Backend: lib/ y config/ (lib/prisma.ts y lib/auth.ts sí usan Prisma).
  {
    files: ['src/lib/**/*.ts', 'src/config/**/*.ts'],
    rules: { 'no-restricted-imports': restrict({ patterns: [frontendFromBackend] }) },
  },
  // Backend: server/ salvo features/, shared/, router.ts y app.ts (errors/, middlewares/).
  {
    files: ['src/server/**/*.ts'],
    ignores: [
      'src/server/features/**',
      'src/server/shared/**',
      'src/server/router.ts',
      'src/server/app.ts',
    ],
    rules: {
      'no-restricted-imports': restrict({ patterns: [prismaImports, frontendFromBackend] }),
    },
  },
  // Backend: únicos archivos que pueden usar OpenAPIHono.
  {
    files: ['src/server/router.ts', 'src/server/app.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [prismaImports, frontendFromBackend],
        allowOpenApiHono: true,
      }),
    },
  },
  // Backend: shared/ no importa features, lib/ (Prisma incluido), config/, generated/ ni frontend.
  // Lo prueba shared/__tests__/eslint-limites.test.ts.
  {
    files: ['src/server/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [...serverInfraFromShared, ...featuresFromShared, frontendFromBackend],
      }),
    },
  },
  // Backend: features, salvo repositories, condiciones y tests.
  {
    files: ['src/server/features/**/*.ts'],
    ignores: [
      'src/server/features/**/*.repository.ts',
      'src/server/features/**/*.condiciones.ts',
      'src/server/features/**/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [
          prismaImports,
          crossFeatureImports,
          ...otraFeatureSoloLecturas,
          frontendFromBackend,
        ],
      }),
    },
  },
  // Backend: repositories y condiciones (únicos de las features que usan Prisma; las condiciones
  // solo sus tipos: reciben el cliente).
  {
    files: ['src/server/features/**/*.repository.ts', 'src/server/features/**/*.condiciones.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [
          crossFeatureImports,
          repositoryDeOtraFeature,
          ...otraFeatureSoloLecturas,
          frontendFromBackend,
        ],
      }),
    },
  },
  // Backend: tests de las features. Pueden importar tipos de la validation de otra feature (para
  // armar sus falsos), pero no su service, controller ni routes, ni Prisma.
  {
    files: ['src/server/features/**/__tests__/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [prismaImports, crossFeatureImports, frontendFromBackend],
      }),
    },
  },
  // Backend: adaptadores de Next para Hono y Better Auth.
  {
    files: ['src/app/api/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict({ patterns: [prismaImports, frontendFromBackend] }),
    },
  },
  // Frontend: app/ (salvo api/) y features/.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**'],
    rules: { 'no-restricted-imports': restrict({ patterns: backendFromFrontend }) },
  },
  // Frontend: components/ (UI sin entidad).
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [...backendFromFrontend, ...featuresFromComponents],
      }),
    },
  },
  // Frontend: utilidades genéricas.
  {
    files: ['src/hooks/**/*.{ts,tsx}', 'src/types/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict({ patterns: [...backendFromFrontend, ...uiFromGeneric] }),
    },
  },
  // proxy.ts: independiente del resto del proyecto.
  {
    files: ['src/proxy.ts'],
    rules: { 'no-restricted-imports': restrict({ patterns: fromProxy }) },
  },

  prettier,
])

export default eslintConfig
