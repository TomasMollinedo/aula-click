import { ConflictError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import type { MateriasRepository } from './materias.repository'
import type {
  CrearMateria,
  ListarMateriasQuery,
  MateriaDetalle,
  MateriaGuardada,
  MateriaProfesor,
} from './materias.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

const MENSAJE_NO_ENCONTRADA = 'Materia no encontrada'
const MENSAJE_CON_PROFESORES = 'No se puede dar de baja una materia con profesores asignados'

/** Código del 409 al dar de baja una materia con asignaciones activas (`contrato-api.md`). */
export const CODIGO_MATERIA_CON_PROFESORES = 'MATERIA_CON_PROFESORES'

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos. Los importa solo como tipo, así el service no carga Prisma ni
 * `@/config/env`. De profesores solo necesita una lectura: el `Pick` lo deja explícito.
 */
export function crearMateriasService({
  repository,
  profesoresRepository,
}: {
  repository: MateriasRepository
  profesoresRepository: Pick<ProfesoresRepository, 'listarProfesoresDeMateria'>
}) {
  const conProfesores = (
    materia: MateriaGuardada,
    profesores: MateriaProfesor[],
  ): MateriaDetalle => ({ ...materia, profesores })

  return {
    listar(query: ListarMateriasQuery) {
      return repository.listar({
        page: query.page,
        pageSize: query.pageSize,
        terminos: terminosDeBusqueda(query.q),
        // `TODOS` es "sin filtro": el repository solo conoce los valores de `Estado`.
        estado: query.estado === 'TODOS' ? undefined : query.estado,
      })
    },

    /** Selector de catálogo: materias activas, sin paginar (`contrato-api.md` → Selectores). */
    listarActivas() {
      return repository.listarActivas()
    },

    async obtener(id: number): Promise<MateriaDetalle> {
      const materia = await repository.buscarPorId(id)
      if (!materia) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)
      // Activos o no: el detalle muestra a todos los que la dictan, con su estado.
      return conProfesores(materia, await profesoresRepository.listarProfesoresDeMateria(id))
    },

    async crear(datos: CrearMateria, actor: Actor): Promise<MateriaDetalle> {
      // `busqueda` es el nombre normalizado y es UNIQUE en la base: así "Matemática" y
      // "matematica" chocan y el repository traduce ese P2002 a 409.
      const materia = await repository.crear(
        { ...datos, busqueda: normalizarBusqueda(datos.nombre) },
        actor,
      )
      // Recién creada: todavía no puede tener asignaciones.
      return conProfesores(materia, [])
    },

    /**
     * Baja lógica. No se puede dar de baja una materia que tiene profesores asignados: se responde
     * 409 con el código específico y los profesores en `details`, para que la UI los liste
     * (`dominio.md` → Profesores y materias).
     */
    async darDeBaja(id: number, actor: Actor): Promise<MateriaDetalle> {
      const materia = await repository.buscarPorId(id)
      if (!materia) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)

      const profesores = await profesoresRepository.listarProfesoresDeMateria(id)
      if (profesores.length > 0) {
        throw new ConflictError(MENSAJE_CON_PROFESORES, {
          code: CODIGO_MATERIA_CON_PROFESORES,
          details: profesores,
        })
      }

      return conProfesores(await repository.darDeBaja(id, actor), [])
    },
  }
}

export type MateriasService = ReturnType<typeof crearMateriasService>
