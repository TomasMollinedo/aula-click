import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

// Reglas de arquitectura (ver AGENTS.md): solo el repository toca Prisma, una feature
// solo importa el repository de otra, process.env solo se lee en config/env.ts y
// OpenAPIHono solo se instancia en server/router.ts.
// no-restricted-imports no se acumula entre bloques: cada bloque declara todo lo suyo.
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
  message: 'Una feature solo puede importar el repository de otra (lecturas).',
}
const serverFromFrontend = {
  group: ['@/server/*', '@/lib/auth', '@/lib/storage'],
  message: 'El frontend consume la API por fetch; no importa código de servidor.',
}
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
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict() },
  },
  {
    files: [
      'src/server/**/*.ts',
      'src/app/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
    ],
    ignores: ['src/server/**/*.repository.ts'],
    rules: { 'no-restricted-imports': restrict({ patterns: [prismaImports] }) },
  },
  {
    files: ['src/server/features/**/*.ts'],
    ignores: ['src/server/**/*.repository.ts'],
    rules: {
      'no-restricted-imports': restrict({ patterns: [prismaImports, crossFeatureImports] }),
    },
  },
  {
    files: ['src/server/features/**/*.repository.ts'],
    rules: { 'no-restricted-imports': restrict({ patterns: [crossFeatureImports] }) },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**'],
    rules: {
      'no-restricted-imports': restrict({ patterns: [prismaImports, serverFromFrontend] }),
    },
  },
  {
    // Únicos archivos que pueden usar OpenAPIHono.
    files: ['src/server/router.ts', 'src/server/app.ts'],
    rules: {
      'no-restricted-imports': restrict({ patterns: [prismaImports], allowOpenApiHono: true }),
    },
  },
  prettier,
])

export default eslintConfig
