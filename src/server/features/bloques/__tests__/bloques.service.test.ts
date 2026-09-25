import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { ProfesorParaBloque } from '@/server/features/profesores/profesores.validation'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import type { BloquesRepository } from '../bloques.repository'
import { crearBloquesService } from '../bloques.service'
import type {
  Bloque,
  BloqueConAula,
  BloqueDetalleGuardado,
  BloqueGuardado,
  CrearBloque,
} from '../bloques.validation'

// El repository de bloques y los de profesores/turnos (solo lectura, cross-feature) se reemplazan
// por falsos: sin Docker ni Postgres. El service los importa solo como tipo.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

// Mediodía del 22/09/2026 en Salta (UTC-3).
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const ACTIVO_CON_MATERIA: ProfesorParaBloque = { estado: 'ACTIVO', tieneMateriaActiva: true }

const DATOS: CrearBloque = {
  profesorId: 3,
  diaSemana: 1,
  horaInicio: '14:00',
  horaFin: '15:00',
  aulaId: 7,
}

const ACTUAL: BloqueGuardado = {
  id: 10,
  profesorId: 3,
  aulaId: 7,
  diaSemana: 1,
  horaInicio: 840, // 14:00
  horaFin: 900, // 15:00
  estado: 'ACTIVO',
}

function crearRepositories() {
  return {
    repository: {
      listarPorProfesor: vi.fn<BloquesRepository['listarPorProfesor']>(),
      crearBloques: vi.fn<BloquesRepository['crearBloques']>(),
      buscarPorId: vi.fn<BloquesRepository['buscarPorId']>(),
      editarBloque: vi.fn<BloquesRepository['editarBloque']>(),
      eliminarBloque: vi.fn<BloquesRepository['eliminarBloque']>(),
      aulasOcupadas: vi.fn<BloquesRepository['aulasOcupadas']>(),
      buscarPorIds: vi.fn<BloquesRepository['buscarPorIds']>(),
      eliminarBloques: vi.fn<BloquesRepository['eliminarBloques']>(),
      buscarDetalle: vi.fn<BloquesRepository['buscarDetalle']>(),
      listarActivasDeProfesores: vi.fn<BloquesRepository['listarActivasDeProfesores']>(),
    },
    profesoresRepository: {
      buscarParaBloque: vi.fn<ProfesoresRepository['buscarParaBloque']>(),
      buscarCapacidad: vi.fn<ProfesoresRepository['buscarCapacidad']>(),
    },
    turnosRepository: {
      contarVigentesPorBloque: vi.fn<TurnosRepository['contarVigentesPorBloque']>(),
      contarVigentesPorBloques: vi.fn<TurnosRepository['contarVigentesPorBloques']>(),
      contarOcupacionPorBloque: vi.fn<TurnosRepository['contarOcupacionPorBloque']>(),
    },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let profesoresRepository: ReturnType<typeof crearRepositories>['profesoresRepository']
let turnosRepository: ReturnType<typeof crearRepositories>['turnosRepository']
let service: ReturnType<typeof crearBloquesService>

beforeEach(() => {
  ;({ repository, profesoresRepository, turnosRepository } = crearRepositories())
  service = crearBloquesService({
    repository,
    profesoresRepository,
    turnosRepository,
    reloj: relojFijo,
  })
  profesoresRepository.buscarParaBloque.mockResolvedValue(ACTIVO_CON_MATERIA)
  profesoresRepository.buscarCapacidad.mockResolvedValue(10)
  turnosRepository.contarVigentesPorBloque.mockResolvedValue(0)
  turnosRepository.contarVigentesPorBloques.mockResolvedValue([])
  turnosRepository.contarOcupacionPorBloque.mockResolvedValue([])
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>) {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error,
  )
}

const bloque = (horaInicio: string, horaFin: string, id: number): Bloque => ({
  id,
  diaSemana: DATOS.diaSemana,
  horaInicio,
  horaFin,
  aula: { id: DATOS.aulaId, nombre: 'Aula 3' },
})

const filaConAula = (
  id: number,
  horaInicio: number,
  horaFin: number,
  aula: BloqueConAula['aula'] = { id: 7, nombre: 'Aula 3', capacidad: 10 },
): BloqueConAula => ({ id, diaSemana: 1, horaInicio, horaFin, aula })

describe('listarPorProfesor', () => {
  it('arma cada fila con su capacidad efectiva (min profesor/aula)', async () => {
    profesoresRepository.buscarCapacidad.mockResolvedValue(6) // menor que la del aula (10)
    repository.listarPorProfesor.mockResolvedValue([filaConAula(10, 840, 900)])

    const resultado = await service.listarPorProfesor(3)

    expect(resultado).toEqual([
      {
        id: 10,
        diaSemana: 1,
        horaInicio: '14:00',
        horaFin: '15:00',
        aula: { id: 7, nombre: 'Aula 3' },
        capacidadEfectiva: 6,
        proximaFecha: '2026-09-28', // HOY es martes 22: el próximo lunes
        ocupacion: 0,
      },
    ])
  })

  it('ocupación: una sola consulta con cada fila y su próxima fecha (hoy incluido), 0 si no hay turnos', async () => {
    repository.listarPorProfesor.mockResolvedValue([
      { ...filaConAula(10, 840, 900), diaSemana: 1 }, // lunes → 28/09
      { ...filaConAula(11, 840, 900), diaSemana: 2 }, // martes = HOY → 22/09
      { ...filaConAula(12, 900, 960), diaSemana: 7 }, // domingo → 27/09
    ])
    turnosRepository.contarOcupacionPorBloque.mockResolvedValue([
      { bloqueAgendaId: 11, fecha: '2026-09-22', cantidad: 3 },
      { bloqueAgendaId: 12, fecha: '2026-09-27', cantidad: 1 },
    ])

    const resultado = await service.listarPorProfesor(3)

    expect(turnosRepository.contarOcupacionPorBloque).toHaveBeenCalledTimes(1)
    expect(turnosRepository.contarOcupacionPorBloque).toHaveBeenCalledWith([
      { bloqueAgendaId: 10, fecha: '2026-09-28' },
      { bloqueAgendaId: 11, fecha: '2026-09-22' },
      { bloqueAgendaId: 12, fecha: '2026-09-27' },
    ])
    expect(
      resultado.map(({ id, proximaFecha, ocupacion }) => ({ id, proximaFecha, ocupacion })),
    ).toEqual([
      { id: 10, proximaFecha: '2026-09-28', ocupacion: 0 },
      { id: 11, proximaFecha: '2026-09-22', ocupacion: 3 },
      { id: 12, proximaFecha: '2026-09-27', ocupacion: 1 },
    ])
  })

  it('la próxima fecha sale del reloj en hora Salta, no de UTC', async () => {
    // 23:30 del martes 22 en Salta = 02:30 UTC del miércoles 23.
    service = crearBloquesService({
      repository,
      profesoresRepository,
      turnosRepository,
      reloj: () => new Date('2026-09-23T02:30:00Z'),
    })
    repository.listarPorProfesor.mockResolvedValue([{ ...filaConAula(11, 840, 900), diaSemana: 2 }])

    const [fila] = await service.listarPorProfesor(3)

    expect(fila?.proximaFecha).toBe('2026-09-22')
  })

  it('la capacidad efectiva usa el menor entre profesor y aula, sea cual sea', async () => {
    profesoresRepository.buscarCapacidad.mockResolvedValue(12) // mayor que la del aula (10)
    repository.listarPorProfesor.mockResolvedValue([filaConAula(10, 840, 900)])

    const [resultado] = await service.listarPorProfesor(3)

    expect(resultado?.capacidadEfectiva).toBe(10)
  })

  it('sin bloques activos, devuelve un arreglo vacío', async () => {
    repository.listarPorProfesor.mockResolvedValue([])

    const resultado = await service.listarPorProfesor(3)

    expect(resultado).toEqual([])
  })

  it('profesor inexistente → NotFoundError, sin consultar bloques ni turnos', async () => {
    profesoresRepository.buscarCapacidad.mockResolvedValue(null)

    const error = await errorDe(service.listarPorProfesor(99))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(repository.listarPorProfesor).not.toHaveBeenCalled()
  })

  it('se puede ver aunque el profesor esté inactivo: no valida su estado', async () => {
    repository.listarPorProfesor.mockResolvedValue([])

    await service.listarPorProfesor(3)

    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
  })
})

describe('crear', () => {
  it('una hora: pide al profesor una sola hora y devuelve cantidad 1', async () => {
    const creado = bloque('14:00', '15:00', 10)
    repository.crearBloques.mockResolvedValue([creado])

    const resultado = await service.crear(DATOS, actor)

    expect(profesoresRepository.buscarParaBloque).toHaveBeenCalledWith(3)
    expect(repository.crearBloques).toHaveBeenCalledWith(
      { profesorId: 3, aulaId: 7, diaSemana: 1, horas: [{ horaInicio: 840, horaFin: 900 }] },
      actor,
    )
    expect(resultado).toEqual({ cantidad: 1, bloques: [creado] })
  })

  it('un rango de varias horas parte en tramos de una hora y pasa los 4 al repository', async () => {
    const datos = { ...DATOS, horaInicio: '14:00', horaFin: '18:00' }
    const creados = [
      bloque('14:00', '15:00', 10),
      bloque('15:00', '16:00', 11),
      bloque('16:00', '17:00', 12),
      bloque('17:00', '18:00', 13),
    ]
    repository.crearBloques.mockResolvedValue(creados)

    const resultado = await service.crear(datos, actor)

    expect(repository.crearBloques).toHaveBeenCalledWith(
      {
        profesorId: 3,
        aulaId: 7,
        diaSemana: 1,
        horas: [
          { horaInicio: 840, horaFin: 900 },
          { horaInicio: 900, horaFin: 960 },
          { horaInicio: 960, horaFin: 1020 },
          { horaInicio: 1020, horaFin: 1080 },
        ],
      },
      actor,
    )
    expect(resultado).toEqual({ cantidad: 4, bloques: creados })
  })

  it('profesor inexistente → NotFoundError, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue(null)

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_INACTIVO' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('profesor sin materias asignadas → 409 PROFESOR_SIN_MATERIAS, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_SIN_MATERIAS' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('bloque superpuesto: propaga el ConflictError BLOQUE_SUPERPUESTO del repository tal cual', async () => {
    const conflicto = new ConflictError('El profesor ya tiene un bloque en ese horario', {
      code: 'BLOQUE_SUPERPUESTO',
      details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', bloqueExistenteId: 5 }],
    })
    repository.crearBloques.mockRejectedValue(conflicto)

    await expect(service.crear(DATOS, actor)).rejects.toBe(conflicto)
  })

  it('aula ocupada: propaga el ConflictError AULA_OCUPADA del repository tal cual', async () => {
    const conflicto = new ConflictError(
      'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
      {
        code: 'AULA_OCUPADA',
        details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', profesorId: 9 }],
      },
    )
    repository.crearBloques.mockRejectedValue(conflicto)

    await expect(service.crear(DATOS, actor)).rejects.toBe(conflicto)
  })

  it('aula inexistente: propaga el NotFoundError del repository tal cual', async () => {
    const noEncontrada = new NotFoundError('Aula no encontrada')
    repository.crearBloques.mockRejectedValue(noEncontrada)

    await expect(service.crear(DATOS, actor)).rejects.toBe(noEncontrada)
  })
})

describe('editar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(ACTUAL)
  })

  it('cambia solo la hora: fusiona con la fila actual y valida que siga durando una hora', async () => {
    const editado = bloque('15:00', '16:00', 10)
    repository.editarBloque.mockResolvedValue(editado)

    const resultado = await service.editar(10, { horaInicio: '15:00', horaFin: '16:00' }, actor)

    expect(repository.editarBloque).toHaveBeenCalledWith(
      10,
      { diaSemana: 1, horaInicio: 900, horaFin: 960, aulaId: 7 },
      actor,
    )
    expect(resultado).toEqual(editado)
  })

  it('cambia solo el aula: conserva día y horario actuales', async () => {
    repository.editarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.editar(10, { aulaId: 9 }, actor)

    expect(repository.editarBloque).toHaveBeenCalledWith(
      10,
      { diaSemana: 1, horaInicio: 840, horaFin: 900, aulaId: 9 },
      actor,
    )
  })

  it('consulta los turnos vigentes de esa fila con la fecha de hoy del reloj', async () => {
    repository.editarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.editar(10, { aulaId: 9 }, actor)

    expect(turnosRepository.contarVigentesPorBloque).toHaveBeenCalledWith(10, HOY)
  })

  it('bloque inexistente → NotFoundError, sin consultar turnos ni al profesor', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.editar(99, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Bloque no encontrado' })
    expect(turnosRepository.contarVigentesPorBloque).not.toHaveBeenCalled()
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad, sin tocar nada más', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(2)

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'TURNOS_VIGENTES', details: { cantidad: 2 } })
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('el resultado deja de durar una hora exacta → 400 VALIDACION, sin llamar al repository', async () => {
    const error = await errorDe(service.editar(10, { horaFin: '16:00' }, actor))

    expect(error).toBeInstanceOf(ValidationError)
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_INACTIVO' })
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('profesor sin materias → 409 PROFESOR_SIN_MATERIAS, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_SIN_MATERIAS' })
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('bloque superpuesto: propaga el ConflictError BLOQUE_SUPERPUESTO del repository tal cual', async () => {
    const conflicto = new ConflictError('El profesor ya tiene un bloque en ese horario', {
      code: 'BLOQUE_SUPERPUESTO',
      details: [{ diaSemana: 1, horaInicio: '15:00', horaFin: '16:00', bloqueExistenteId: 20 }],
    })
    repository.editarBloque.mockRejectedValue(conflicto)

    await expect(service.editar(10, { horaInicio: '15:00', horaFin: '16:00' }, actor)).rejects.toBe(
      conflicto,
    )
  })

  it('aula inexistente: propaga el NotFoundError del repository tal cual', async () => {
    const noEncontrada = new NotFoundError('Aula no encontrada')
    repository.editarBloque.mockRejectedValue(noEncontrada)

    await expect(service.editar(10, { aulaId: 999 }, actor)).rejects.toBe(noEncontrada)
  })
})

describe('eliminar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(ACTUAL)
  })

  it('sin turnos vigentes: da de baja y no valida al profesor', async () => {
    const eliminado = bloque('14:00', '15:00', 10)
    repository.eliminarBloque.mockResolvedValue(eliminado)

    const resultado = await service.eliminar(10, actor)

    expect(repository.eliminarBloque).toHaveBeenCalledWith(10, actor)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
    expect(resultado).toEqual(eliminado)
  })

  it('se puede dar de baja aunque el profesor esté inactivo', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    repository.eliminarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await expect(service.eliminar(10, actor)).resolves.not.toThrow()
  })

  it('bloque inexistente → NotFoundError, sin consultar turnos', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.eliminar(99, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Bloque no encontrado' })
    expect(turnosRepository.contarVigentesPorBloque).not.toHaveBeenCalled()
    expect(repository.eliminarBloque).not.toHaveBeenCalled()
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad, sin dar de baja', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(1)

    const error = await errorDe(service.eliminar(10, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'TURNOS_VIGENTES', details: { cantidad: 1 } })
    expect(repository.eliminarBloque).not.toHaveBeenCalled()
  })

  it('consulta los turnos vigentes de esa fila con la fecha de hoy del reloj', async () => {
    repository.eliminarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.eliminar(10, actor)

    expect(turnosRepository.contarVigentesPorBloque).toHaveBeenCalledWith(10, HOY)
  })
})

describe('eliminarVarios', () => {
  const guardado = (id: number, horaInicio: number, extra: Partial<BloqueGuardado> = {}) => ({
    ...ACTUAL,
    id,
    horaInicio,
    horaFin: horaInicio + 60,
    ...extra,
  })

  beforeEach(() => {
    repository.buscarPorIds.mockResolvedValue([
      guardado(10, 840), // 14:00
      guardado(11, 900), // 15:00
      guardado(12, 960), // 16:00
    ])
  })

  it('varias horas sin turnos vigentes: las da de baja juntas y devuelve cantidad y detalle', async () => {
    const eliminados = [
      bloque('14:00', '15:00', 10),
      bloque('15:00', '16:00', 11),
      bloque('16:00', '17:00', 12),
    ]
    repository.eliminarBloques.mockResolvedValue(eliminados)

    const resultado = await service.eliminarVarios({ bloqueIds: [10, 11, 12] }, actor)

    expect(turnosRepository.contarVigentesPorBloques).toHaveBeenCalledWith([10, 11, 12], HOY)
    expect(repository.eliminarBloques).toHaveBeenCalledWith([10, 11, 12], actor)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
    expect(resultado).toEqual({ cantidad: 3, bloques: eliminados })
  })

  it('ids repetidos: el service tampoco los acepta como válidos (los frena el schema)', async () => {
    const { eliminarBloquesSchema } = await import('../bloques.validation')
    expect(eliminarBloquesSchema.safeParse({ bloqueIds: [10, 10] }).success).toBe(false)
    expect(eliminarBloquesSchema.safeParse({ bloqueIds: [] }).success).toBe(false)
  })

  it('inexistente o ya dada de baja → 404 con details por posición, sin dar de baja ninguna', async () => {
    repository.buscarPorIds.mockResolvedValue([
      guardado(10, 840),
      guardado(11, 900, { estado: 'INACTIVO' }),
    ])

    const error = await errorDe(service.eliminarVarios({ bloqueIds: [10, 11, 99] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({
      details: [
        { path: ['bloqueIds', 1], message: 'El bloque 11 no existe o ya fue dado de baja' },
        { path: ['bloqueIds', 2], message: 'El bloque 99 no existe o ya fue dado de baja' },
      ],
    })
    expect(turnosRepository.contarVigentesPorBloques).not.toHaveBeenCalled()
    expect(repository.eliminarBloques).not.toHaveBeenCalled()
  })

  it('horas de dos profesores → 400 VALIDACION, sin consultar turnos ni dar de baja', async () => {
    repository.buscarPorIds.mockResolvedValue([
      guardado(10, 840),
      guardado(20, 840, { profesorId: 9 }),
    ])

    const error = await errorDe(service.eliminarVarios({ bloqueIds: [10, 20] }, actor))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({
      details: [{ path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' }],
    })
    expect(turnosRepository.contarVigentesPorBloques).not.toHaveBeenCalled()
    expect(repository.eliminarBloques).not.toHaveBeenCalled()
  })

  it('con turnos vigentes en alguna → 409 TURNOS_VIGENTES por posición y no da de baja ninguna', async () => {
    turnosRepository.contarVigentesPorBloques.mockResolvedValue([
      { bloqueAgendaId: 12, cantidad: 2 },
    ])

    const error = await errorDe(service.eliminarVarios({ bloqueIds: [10, 11, 12] }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: [
        {
          path: ['bloqueIds', 2],
          message: 'La hora de 16:00 a 17:00 tiene 2 turnos vigentes',
          cantidad: 2,
        },
      ],
    })
    expect(repository.eliminarBloques).not.toHaveBeenCalled()
  })

  it('una sola hora con un turno vigente usa el singular', async () => {
    turnosRepository.contarVigentesPorBloques.mockResolvedValue([
      { bloqueAgendaId: 10, cantidad: 1 },
    ])

    const error = await errorDe(service.eliminarVarios({ bloqueIds: [10] }, actor))

    expect(error).toMatchObject({
      details: [
        expect.objectContaining({ message: 'La hora de 14:00 a 15:00 tiene 1 turno vigente' }),
      ],
    })
  })

  it('carrera: si el repository no puede dar de baja todas, propaga su NotFoundError', async () => {
    const noEncontrado = new NotFoundError('Bloque no encontrado')
    repository.eliminarBloques.mockRejectedValue(noEncontrado)

    await expect(service.eliminarVarios({ bloqueIds: [10, 11] }, actor)).rejects.toBe(noEncontrado)
  })
})

describe('obtener', () => {
  const AUDITORIA = {
    createdAt: '2026-09-20T13:00:00.000Z',
    updatedAt: '2026-09-21T10:30:00.000Z',
    createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
    updatedBy: { id: 'usr_mesa_2', nombre: 'Luis', apellido: 'Paz' },
  }
  const DETALLE: BloqueDetalleGuardado = {
    id: 10,
    diaSemana: 1,
    horaInicio: 840,
    horaFin: 900,
    estado: 'ACTIVO',
    aula: { id: 7, nombre: 'Aula 3', capacidad: 4 },
    profesor: { id: 3, nombre: 'Sofía', apellido: 'Herrera', capacidad: 6 },
    ...AUDITORIA,
  }

  it('arma el detalle: horas, capacidad efectiva, ocupación de la próxima fecha y auditoría', async () => {
    repository.buscarDetalle.mockResolvedValue(DETALLE)
    turnosRepository.contarOcupacionPorBloque.mockResolvedValue([
      { bloqueAgendaId: 10, fecha: '2026-09-28', cantidad: 2 },
    ])

    const resultado = await service.obtener(10)

    expect(turnosRepository.contarOcupacionPorBloque).toHaveBeenCalledWith([
      { bloqueAgendaId: 10, fecha: '2026-09-28' }, // HOY es martes 22: el próximo lunes
    ])
    expect(resultado).toEqual({
      id: 10,
      diaSemana: 1,
      horaInicio: '14:00',
      horaFin: '15:00',
      estado: 'ACTIVO',
      aula: { id: 7, nombre: 'Aula 3', capacidad: 4 },
      profesor: { id: 3, nombre: 'Sofía', apellido: 'Herrera' },
      capacidadEfectiva: 4, // min(6, 4)
      proximaFecha: '2026-09-28',
      ocupacion: 2,
      ...AUDITORIA,
    })
  })

  it('una hora dada de baja también se puede ver, con su estado', async () => {
    repository.buscarDetalle.mockResolvedValue({ ...DETALLE, estado: 'INACTIVO' })

    const resultado = await service.obtener(10)

    expect(resultado).toMatchObject({ estado: 'INACTIVO', ocupacion: 0 })
  })

  it('bloque inexistente → NotFoundError, sin consultar turnos', async () => {
    repository.buscarDetalle.mockResolvedValue(null)

    const error = await errorDe(service.obtener(99))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Bloque no encontrado' })
    expect(turnosRepository.contarOcupacionPorBloque).not.toHaveBeenCalled()
  })
})
