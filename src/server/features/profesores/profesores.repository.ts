import { prisma } from '@/lib/prisma'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError).
// Sin reglas de negocio.
//
// PARCIAL (T-07): la feature profesores todavía no está implementada. Acá hay una sola lectura, la
// que materias necesita para el detalle y para la baja (HU-03); es una dependencia entre features,
// que solo pueden importarse el repository (arquitectura-backend.md → Dependencias entre features).
// Quien implemente T-07 puede reordenar, renombrar o mover esta función: materias la consume por
// su tipo (`Pick<ProfesoresRepository, 'listarActivosPorMateria'>`), así el cambio se ve al compilar.

/**
 * Profesor con una asignación activa a una materia. Los datos personales y el estado son los de su
 * `Usuario`: `Profesor` no tiene ni unos ni otro (`prisma/schema.prisma`).
 */
export type ProfesorDeMateria = {
  id: number
  apellido: string
  nombre: string
  estado: 'ACTIVO' | 'INACTIVO'
}

export const profesoresRepository = {
  /**
   * Profesores con una asignación **activa** a la materia (el estado de la asignación, no el del
   * profesor: un profesor inactivo con la materia asignada sigue apareciendo, con su estado).
   * Orden por la `busqueda` del usuario (apellido y nombre normalizados), como los demás listados,
   * para no depender de la collation de Postgres; `profesorId` desempata.
   */
  async listarActivosPorMateria(materiaId: number): Promise<ProfesorDeMateria[]> {
    const asignaciones = await prisma.asignacionMateria.findMany({
      where: { materiaId, estado: 'ACTIVO' },
      select: {
        profesor: {
          select: { id: true, usuario: { select: { nombre: true, apellido: true, estado: true } } },
        },
      },
      orderBy: [{ profesor: { usuario: { busqueda: 'asc' } } }, { profesorId: 'asc' }],
    })
    return asignaciones.map(({ profesor }) => ({
      id: profesor.id,
      apellido: profesor.usuario.apellido,
      nombre: profesor.usuario.nombre,
      estado: profesor.usuario.estado,
    }))
  },
}

export type ProfesoresRepository = typeof profesoresRepository
