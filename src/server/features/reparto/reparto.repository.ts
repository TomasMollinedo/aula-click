import { prisma } from '@/lib/prisma'
import { SELECT_USUARIO_AUDITORIA, type UsuarioAuditoria } from '@/server/shared/auditoria'
import { ORDEN_VIGENTE } from './reparto.condiciones'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio. El `Decimal` no sale de acá: el
// porcentaje se devuelve como `number` (convenciones-backend.md → Importes).

/** Una fila de `PorcentajeCentro`, sin Prisma. */
export type FilaPorcentaje = {
  id: number
  porcentaje: number
  createdAt: Date
  createdBy: UsuarioAuditoria
}

const SELECT_FILA = {
  id: true,
  porcentaje: true,
  createdAt: true,
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
} as const

function aFila(fila: {
  id: number
  porcentaje: { toNumber(): number }
  createdAt: Date
  createdBy: UsuarioAuditoria
}): FilaPorcentaje {
  return { ...fila, porcentaje: fila.porcentaje.toNumber() }
}

export const repartoRepository = {
  /** El vigente (la primera fila en `ORDEN_VIGENTE`), o `null` si la tabla está vacía. */
  async leerVigente(): Promise<FilaPorcentaje | null> {
    const fila = await prisma.porcentajeCentro.findFirst({
      orderBy: ORDEN_VIGENTE,
      select: SELECT_FILA,
    })
    return fila && aFila(fila)
  },

  /** Una página del historial, del más reciente al más antiguo, y el total de filas. */
  async leerHistorial(pagina: {
    skip: number
    take: number
  }): Promise<{ filas: FilaPorcentaje[]; total: number }> {
    const [filas, total] = await prisma.$transaction([
      prisma.porcentajeCentro.findMany({ orderBy: ORDEN_VIGENTE, select: SELECT_FILA, ...pagina }),
      prisma.porcentajeCentro.count(),
    ])
    return { filas: filas.map(aFila), total }
  },

  /** Registra un cambio: una fila nueva, que pasa a ser la vigente. */
  async crear(datos: { porcentaje: number; createdById: string }): Promise<FilaPorcentaje> {
    const fila = await prisma.porcentajeCentro.create({
      data: { porcentaje: String(datos.porcentaje), createdById: datos.createdById },
      select: SELECT_FILA,
    })
    return aFila(fila)
  },
}

export type RepartoRepository = typeof repartoRepository
