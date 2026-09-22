import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

// Prueba la regla de eslint.config.mjs "shared/ no importa features ni Prisma" con el config real.
// no-restricted-imports no se acumula entre bloques: si otro bloque la pisa, este test falla.
// lintText no escribe nada en disco; filePath solo decide qué bloques del config aplican.

const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ cwd: raiz })
})

async function erroresDeImport(filePath: string, codigo: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath })
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message)
}

const importar = (ruta: string) => `import * as modulo from '${ruta}'\nexport { modulo }\n`

describe(
  'ESLint: shared/ no importa features, lib/, config/ ni frontend',
  { timeout: 30_000 },
  () => {
    it.each([
      ['src/server/shared/x.ts', '@/server/features/alumnos/alumnos.repository'],
      ['src/server/shared/x.ts', '@/server/features'],
      ['src/server/shared/x.ts', '../features/alumnos/alumnos.service'],
      ['src/server/shared/__tests__/x.test.ts', '../../features/alumnos/alumnos.service'],
      ['src/server/shared/x.ts', '@/lib/prisma'],
      ['src/server/shared/x.ts', '@/generated/prisma/client'],
      ['src/server/shared/x.ts', '../../lib/prisma'],
      ['src/server/shared/x.ts', '@/lib/auth'],
      ['src/server/shared/x.ts', '@/lib'],
      ['src/server/shared/x.ts', '../../lib/storage'],
      ['src/server/shared/x.ts', '@/config/env'],
      ['src/server/shared/__tests__/x.test.ts', '../../../config/env'],
      ['src/server/shared/x.ts', '@/features/alumnos/alumnos.types'],
    ])('desde %s, importar %s da error', async (filePath, ruta) => {
      expect(await erroresDeImport(filePath, importar(ruta))).toHaveLength(1)
    })
  },
)

describe('ESLint: las features y shared/ pueden importar de shared/', { timeout: 30_000 }, () => {
  it.each([
    'src/server/features/alumnos/alumnos.service.ts',
    'src/server/features/alumnos/alumnos.repository.ts',
    'src/server/features/alumnos/alumnos.validation.ts',
  ])('%s importa @/server/shared/fechas', async (filePath) => {
    const codigo = "import { hoy } from '@/server/shared/fechas'\nexport { hoy }\n"
    expect(await erroresDeImport(filePath, codigo)).toEqual([])
  })

  it('shared/zod.ts importa z de @hono/zod-openapi', async () => {
    const codigo = "import { z } from '@hono/zod-openapi'\nexport { z }\n"
    expect(await erroresDeImport('src/server/shared/zod.ts', codigo)).toEqual([])
  })

  it('shared/ importa otro archivo de shared/ con ruta relativa', async () => {
    const codigo = "import { hoy } from './fechas'\nexport { hoy }\n"
    expect(await erroresDeImport('src/server/shared/zod.ts', codigo)).toEqual([])
  })
})
