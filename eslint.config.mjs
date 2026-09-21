import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

// Reglas de arquitectura (ver CLAUDE.md): solo el repository toca Prisma, una feature
// solo importa el repository de otra, y process.env solo se lee en config/env.ts.
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
    files: ['src/server/**/*.ts', 'src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['src/server/**/*.repository.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [prismaImports] }] },
  },
  {
    files: ['src/server/features/**/*.ts'],
    ignores: ['src/server/**/*.repository.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [prismaImports, crossFeatureImports] }],
    },
  },
  {
    files: ['src/server/features/**/*.repository.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossFeatureImports] }] },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [prismaImports, serverFromFrontend] }],
    },
  },
  prettier,
])

export default eslintConfig
