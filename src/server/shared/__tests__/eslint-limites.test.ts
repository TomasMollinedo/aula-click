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
      // Los .tsx (primitivas de los documentos PDF) caen en la misma zona.
      ['src/server/shared/pdf/x.tsx', '@/server/features/centro/centro.condiciones'],
      ['src/server/shared/pdf/x.tsx', '../../features/centro/centro.condiciones'],
      ['src/server/shared/pdf/x.tsx', '@/lib/prisma'],
      ['src/server/shared/pdf/x.tsx', '@/config/env'],
      ['src/server/shared/pdf/x.tsx', '@/components/ui/button'],
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

  it('shared/pdf/*.tsx importa @react-pdf/renderer y otro archivo de shared/', async () => {
    const codigo =
      "import { View } from '@react-pdf/renderer'\nimport { px } from './estilos'\nexport { View, px }\n"
    expect(await erroresDeImport('src/server/shared/pdf/x.tsx', codigo)).toEqual([])
  })

  it('shared/ importa otro archivo de shared/ con ruta relativa', async () => {
    const codigo = "import { hoy } from './fechas'\nexport { hoy }\n"
    expect(await erroresDeImport('src/server/shared/zod.ts', codigo)).toEqual([])
  })
})

// Entre features (decisión T-39): de otra feature solo se importa su repository o sus condiciones,
// y un repository no importa el repository de otra. Los tests pueden importar tipos de la
// validation de otra feature para armar sus falsos.
describe('ESLint: de otra feature solo *.repository o *.condiciones', { timeout: 30_000 }, () => {
  it.each([
    ['src/server/features/bloques/bloques.service.ts', '@/server/features/turnos/turnos.reglas'],
    [
      'src/server/features/bloques/bloques.service.ts',
      '@/server/features/turnos/turnos.validation',
    ],
    ['src/server/features/bloques/bloques.service.ts', '../turnos/turnos.reglas'],
    [
      'src/server/features/bloques/bloques.repository.ts',
      '@/server/features/turnos/turnos.repository',
    ],
    [
      'src/server/features/bloques/bloques.repository.ts',
      '@/server/features/turnos/turnos.validation',
    ],
    [
      'src/server/features/turnos/turnos.condiciones.ts',
      '@/server/features/profesores/profesores.repository',
    ],
    // Una plantilla PDF (.tsx) sigue las reglas de su feature.
    ['src/server/features/pagos/pagos.pdf.tsx', '@/server/features/centro/centro.datos'],
    ['src/server/features/pagos/pagos.pdf.tsx', '@/server/features/centro/centro.logo-pdf'],
    ['src/server/features/pagos/pagos.pdf.tsx', '@/lib/prisma'],
    ['src/server/features/pagos/pagos.pdf.tsx', '@/utils/moneda'],
  ])('desde %s, importar %s da error', async (filePath, ruta) => {
    expect(await erroresDeImport(filePath, importar(ruta))).toHaveLength(1)
  })

  it.each([
    [
      'src/server/features/bloques/bloques.service.ts',
      '@/server/features/turnos/turnos.repository',
    ],
    [
      'src/server/features/bloques/bloques.repository.ts',
      '@/server/features/turnos/turnos.condiciones',
    ],
    ['src/server/features/turnos/turnos.condiciones.ts', '@/generated/prisma/client'],
    ['src/server/features/turnos/turnos.repository.ts', './turnos.condiciones'],
    ['src/server/features/turnos/turnos.service.ts', './turnos.reglas'],
    [
      'src/server/features/bloques/__tests__/bloques.service.test.ts',
      '@/server/features/profesores/profesores.validation',
    ],
    ['src/server/features/pagos/pagos.pdf.tsx', '@/server/features/centro/centro.condiciones'],
    ['src/server/features/pagos/pagos.pdf.tsx', '@/server/shared/pdf/tabla'],
    ['src/server/features/pagos/pagos.pdf.tsx', './pagos.formato'],
    ['src/server/features/centro/centro.condiciones.ts', './centro.logo-pdf'],
  ])('desde %s, importar %s está permitido', async (filePath, ruta) => {
    expect(await erroresDeImport(filePath, importar(ruta))).toEqual([])
  })
})
