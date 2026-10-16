import { ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { calcularSkipTake, armarMeta, type PaginacionQuery } from '@/server/shared/paginacion'
import type { FilaPorcentaje, RepartoRepository } from './reparto.repository'
import { MENSAJE_SIN_PORCENTAJE, textoPorcentaje } from './reparto.reglas'
import type {
  CambiarPorcentaje,
  CambioPorcentaje,
  PorcentajeCentro,
  PorcentajeCentroConHistorial,
} from './reparto.validation'

// Reglas de negocio del porcentaje del centro (HU-43, T-120). No conoce HTTP ni Prisma: lanza
// AppError o sus subclases. Sin ningún porcentaje es un error de configuración (decisión T-161):
// un `Error` común, que el `errorHandler` registra y responde 500.

const centesimos = (porcentaje: number) => Math.round(porcentaje * 100)

function aVigente(fila: FilaPorcentaje): PorcentajeCentro {
  return {
    porcentaje: fila.porcentaje,
    desde: fila.createdAt.toISOString(),
    cambiadoPor: fila.createdBy,
  }
}

function aCambio(fila: FilaPorcentaje): CambioPorcentaje {
  return { id: fila.id, ...aVigente(fila) }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso.
 */
export function crearRepartoService({
  repository,
}: {
  repository: Pick<RepartoRepository, 'leerVigente' | 'leerHistorial' | 'crear'>
}) {
  async function exigirVigente(): Promise<FilaPorcentaje> {
    const vigente = await repository.leerVigente()
    if (!vigente) throw new Error(MENSAJE_SIN_PORCENTAJE)
    return vigente
  }

  return {
    /** El vigente y una página del historial, del más reciente al más antiguo. */
    async leer(query: PaginacionQuery): Promise<PorcentajeCentroConHistorial> {
      const vigente = await exigirVigente()
      const { filas, total } = await repository.leerHistorial(calcularSkipTake(query))
      return {
        vigente: aVigente(vigente),
        historial: { data: filas.map(aCambio), meta: armarMeta(query, total) },
      }
    },

    /**
     * Cambia el porcentaje: una fila nueva de `PorcentajeCentro`, que pasa a ser la vigente. No
     * toca nada más (cada cobro ya guardó el suyo). Igual al vigente (en centésimos) → 400 en
     * `porcentaje`, sin crear fila.
     */
    async cambiar(datos: CambiarPorcentaje, actor: Actor): Promise<PorcentajeCentro> {
      const vigente = await exigirVigente()
      if (centesimos(datos.porcentaje) === centesimos(vigente.porcentaje)) {
        throw new ValidationError('Datos de entrada inválidos', {
          details: [
            {
              path: ['porcentaje'],
              message: `El porcentaje ya es ${textoPorcentaje(vigente.porcentaje)}`,
            },
          ],
        })
      }
      return aVigente(
        await repository.crear({ porcentaje: datos.porcentaje, createdById: actor.userId }),
      )
    },
  }
}

export type RepartoService = ReturnType<typeof crearRepartoService>
