import { describe, expect, it } from 'vitest'
import {
  ORDEN_PROFESORES_POR_DEFECTO,
  UMBRAL_ASISTENCIA_ALUMNO,
  alumnosAtendidos,
  conteosDeAsistencia,
  filasDeMaterias,
  filasDeProfesores,
  ordenarProfesores,
  resumenDeAsistencia,
  soloQueNoRegistran,
  type OcurrenciaAsistencia,
} from '../tablero.reglas'

// Reglas puras de la asistencia del tablero (HU-39, T-112, decisión T-162). Los estados y el plazo
// los decide el motor de ocurrencias: acá se parte de ellos.

const MATERIAS: Record<number, string> = { 1: 'Álgebra', 2: 'Matemática', 3: 'Física' }

const PROFESORES: Record<number, { nombre: string; apellido: string }> = {
  1: { nombre: 'Ana', apellido: 'Gómez' },
  2: { nombre: 'Luis', apellido: 'Pérez' },
  3: { nombre: 'Marta', apellido: 'Álvarez' },
  4: { nombre: 'Juan', apellido: 'Pérez' },
}

type Opciones = { profesorId?: number; materiaId?: number; alumnoId?: number }

let secuencia = 0

function ocurrencia(
  estado: OcurrenciaAsistencia['estado'],
  { profesorId = 1, materiaId = 2, alumnoId }: Opciones = {},
): OcurrenciaAsistencia {
  secuencia += 1
  // El motor da plazo a toda ocurrencia pasada no cancelada; las agendadas y canceladas no lo tienen.
  const conPlazo = estado !== 'AGENDADO' && estado !== 'CANCELADO'
  return {
    fecha: '2026-09-28',
    estado,
    bloqueAgendaId: 10,
    alumnoId: alumnoId ?? 1000 + secuencia,
    plazoAsistencia: conPlazo ? { vence: '2026-10-05', vencido: false } : null,
    materia: { id: materiaId, nombre: MATERIAS[materiaId] ?? `Materia ${materiaId}` },
    profesor: {
      id: profesorId,
      ...(PROFESORES[profesorId] ?? { nombre: 'Nombre', apellido: `Apellido ${profesorId}` }),
    },
  }
}

/** Un "Sin registrar" que cerró el sistema (plazo vencido). */
function cerrado(opciones: Opciones = {}): OcurrenciaAsistencia {
  return {
    ...ocurrencia('SIN_REGISTRAR', opciones),
    plazoAsistencia: { vence: '2026-10-05', vencido: true },
  }
}

const repetir = (cantidad: number, crear: () => OcurrenciaAsistencia) =>
  Array.from({ length: cantidad }, crear)

describe('conteosDeAsistencia', () => {
  it('cantidad y porcentaje sobre los turnos con asistencia registrada, no sobre el total', () => {
    const resultado = conteosDeAsistencia([
      ...repetir(3, () => ocurrencia('REALIZADO')),
      ocurrencia('AUSENTE'),
      // Fuera de la base: ni cerrados ni pendientes ni agendados ni cancelados.
      cerrado(),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('AGENDADO'),
      ocurrencia('CANCELADO'),
    ])

    expect(resultado.asistio).toEqual({ cantidad: 3, porcentaje: 75 })
    expect(resultado.noAsistio).toEqual({ cantidad: 1, porcentaje: 25 })
  })

  it('redondea a un decimal sin ajustar para sumar 100', () => {
    const resultado = conteosDeAsistencia([
      ocurrencia('REALIZADO'),
      ocurrencia('REALIZADO'),
      ocurrencia('AUSENTE'),
    ])

    expect(resultado.asistio.porcentaje).toBe(66.7)
    expect(resultado.noAsistio.porcentaje).toBe(33.3)
  })

  it('base 0 (ninguna asistencia registrada) → todo en 0, sin dividir por cero', () => {
    const resultado = conteosDeAsistencia([cerrado(), ocurrencia('AGENDADO')])

    expect(resultado.asistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(resultado.noAsistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(conteosDeAsistencia([]).asistio).toEqual({ cantidad: 0, porcentaje: 0 })
  })
})

describe('alumnosAtendidos', () => {
  it('alumnos distintos con al menos un turno realizado', () => {
    expect(
      alumnosAtendidos([
        ocurrencia('REALIZADO', { alumnoId: 1 }),
        ocurrencia('REALIZADO', { alumnoId: 1 }),
        ocurrencia('REALIZADO', { alumnoId: 2 }),
      ]),
    ).toBe(2)
  })

  it('un alumno sólo con ausencias, cerrados, agendados o cancelados no cuenta', () => {
    expect(
      alumnosAtendidos([
        ocurrencia('AUSENTE', { alumnoId: 1 }),
        cerrado({ alumnoId: 2 }),
        ocurrencia('AGENDADO', { alumnoId: 3 }),
        ocurrencia('CANCELADO', { alumnoId: 4 }),
        ocurrencia('REALIZADO', { alumnoId: 5 }),
      ]),
    ).toBe(1)
  })

  it('sin turnos → 0', () => {
    expect(alumnosAtendidos([])).toBe(0)
  })
})

describe('filasDeProfesores', () => {
  it('clases realizadas, ausencias, cerrados, dentro del plazo y los dos porcentajes de cada uno', () => {
    const filas = filasDeProfesores([
      ...repetir(3, () => ocurrencia('REALIZADO')),
      ocurrencia('AUSENTE'),
      cerrado(),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('AGENDADO'),
      // Un cancelado no cuenta: ni en las cifras ni en la base del porcentaje.
      ocurrencia('CANCELADO'),
    ])

    expect(filas).toEqual([
      {
        profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' },
        clasesRealizadas: 3,
        ausencias: 1,
        porcentajeAsistencia: 75,
        cerradosSinRegistrar: 1,
        dentroDelPlazo: 2,
        // 1 cerrado sobre 8 turnos no cancelados (3 + 1 + 1 + 2 + 1).
        porcentajeSinRegistrar: 12.5,
        noRegistraAsistencia: true,
      },
    ])
  })

  it('`noRegistraAsistencia` sólo con un cerrado: los pendientes dentro del plazo no alcanzan', () => {
    const filas = filasDeProfesores([
      ocurrencia('SIN_REGISTRAR', { profesorId: 1 }),
      ocurrencia('REALIZADO', { profesorId: 1 }),
      cerrado({ profesorId: 2 }),
    ])

    const porId = new Map(filas.map((f) => [f.profesor.id, f]))
    expect(porId.get(1)?.noRegistraAsistencia).toBe(false)
    expect(porId.get(1)?.cerradosSinRegistrar).toBe(0)
    expect(porId.get(2)?.noRegistraAsistencia).toBe(true)
  })

  it('un profesor con todos los turnos cancelados no tiene fila', () => {
    const filas = filasDeProfesores([
      ocurrencia('CANCELADO', { profesorId: 1 }),
      ocurrencia('REALIZADO', { profesorId: 2 }),
    ])

    expect(filas.map((f) => f.profesor.id)).toEqual([2])
  })

  it('profesor sin turnos con asistencia registrada → porcentaje de asistencia 0 (base 0)', () => {
    const [fila] = filasDeProfesores([cerrado(), cerrado()])

    expect(fila).toMatchObject({
      clasesRealizadas: 0,
      ausencias: 0,
      porcentajeAsistencia: 0,
      cerradosSinRegistrar: 2,
      porcentajeSinRegistrar: 100,
    })
  })

  it('sólo agregados: la fila no trae nada del alumno ni el campo interno `busqueda`', () => {
    const [fila] = filasDeProfesores([ocurrencia('REALIZADO')])

    expect(Object.keys(fila ?? {}).sort()).toEqual([
      'ausencias',
      'cerradosSinRegistrar',
      'clasesRealizadas',
      'dentroDelPlazo',
      'noRegistraAsistencia',
      'porcentajeAsistencia',
      'porcentajeSinRegistrar',
      'profesor',
    ])
    expect(Object.keys(fila?.profesor ?? {}).sort()).toEqual(['apellido', 'id', 'nombre'])
  })

  it('sin turnos → sin filas', () => {
    expect(filasDeProfesores([])).toEqual([])
  })
})

describe('filasDeMaterias', () => {
  it('las mismas cifras agrupadas por materia, sin `noRegistraAsistencia`', () => {
    const filas = filasDeMaterias([
      ocurrencia('REALIZADO', { materiaId: 2 }),
      ocurrencia('AUSENTE', { materiaId: 2 }),
      cerrado({ materiaId: 2 }),
      ocurrencia('SIN_REGISTRAR', { materiaId: 2 }),
      ocurrencia('CANCELADO', { materiaId: 3 }),
    ])

    expect(filas).toEqual([
      {
        materia: { id: 2, nombre: 'Matemática' },
        clasesRealizadas: 1,
        ausencias: 1,
        porcentajeAsistencia: 50,
        cerradosSinRegistrar: 1,
        dentroDelPlazo: 1,
        porcentajeSinRegistrar: 25,
      },
    ])
  })

  it('orden fijo: cerrados sin registrar de mayor a menor; en empate, nombre', () => {
    const filas = filasDeMaterias([
      ocurrencia('REALIZADO', { materiaId: 2 }),
      cerrado({ materiaId: 3 }),
      cerrado({ materiaId: 3 }),
      cerrado({ materiaId: 2 }),
      cerrado({ materiaId: 1 }),
    ])

    expect(filas.map((f) => f.materia.nombre)).toEqual(['Física', 'Álgebra', 'Matemática'])
  })
})

describe('ordenarProfesores y soloQueNoRegistran', () => {
  // Gómez: 5 cerrados, Pérez L.: 2, Pérez J.: 2, Álvarez: 0 (con más clases realizadas).
  const filas = filasDeProfesores([
    ...repetir(5, () => cerrado({ profesorId: 1 })),
    ocurrencia('REALIZADO', { profesorId: 1 }),
    ...repetir(2, () => cerrado({ profesorId: 2 })),
    ...repetir(2, () => cerrado({ profesorId: 4 })),
    ...repetir(4, () => ocurrencia('REALIZADO', { profesorId: 3 })),
    ocurrencia('AUSENTE', { profesorId: 3 }),
  ])
  const apellidos = (lista: typeof filas) =>
    lista.map((f) => `${f.profesor.apellido} ${f.profesor.nombre}`)

  it('por defecto: cerrados sin registrar de mayor a menor; en empate, apellido, nombre e id', () => {
    expect(apellidos(ordenarProfesores(filas, ORDEN_PROFESORES_POR_DEFECTO))).toEqual([
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
      'Álvarez Marta',
    ])
  })

  it('ascendente invierte el criterio principal pero no el desempate', () => {
    expect(
      apellidos(ordenarProfesores(filas, { orden: 'cerradosSinRegistrar', direccion: 'asc' })),
    ).toEqual(['Álvarez Marta', 'Pérez Juan', 'Pérez Luis', 'Gómez Ana'])
  })

  it.each([
    ['clasesRealizadas', 'desc', 'Álvarez Marta'],
    ['ausencias', 'desc', 'Álvarez Marta'],
    ['porcentajeAsistencia', 'desc', 'Gómez Ana'],
    ['porcentajeAsistencia', 'asc', 'Pérez Juan'],
    ['porcentajeSinRegistrar', 'desc', 'Pérez Juan'],
    ['dentroDelPlazo', 'asc', 'Álvarez Marta'],
  ] as const)('por `%s` %s empieza con %s', (orden, direccion, primero) => {
    expect(apellidos(ordenarProfesores(filas, { orden, direccion }))[0]).toBe(primero)
  })

  it('por `profesor` ordena por apellido y nombre (con acentos, a la manera del español)', () => {
    expect(apellidos(ordenarProfesores(filas, { orden: 'profesor', direccion: 'asc' }))).toEqual([
      'Álvarez Marta',
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
    ])
    expect(apellidos(ordenarProfesores(filas, { orden: 'profesor', direccion: 'desc' }))[0]).toBe(
      'Pérez Luis',
    )
  })

  it('no modifica la lista que recibe', () => {
    const antes = apellidos(filas)

    ordenarProfesores(filas, { orden: 'profesor', direccion: 'desc' })

    expect(apellidos(filas)).toEqual(antes)
  })

  it('`soloQueNoRegistran` deja sólo a los que tienen al menos un turno cerrado sin registrar', () => {
    expect(apellidos(soloQueNoRegistran(filas)).sort()).toEqual([
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
    ])
  })

  it('el filtro sin ningún profesor que no registre → lista vacía', () => {
    expect(soloQueNoRegistran(filasDeProfesores([ocurrencia('REALIZADO')]))).toEqual([])
  })
})

describe('resumenDeAsistencia', () => {
  it('porcentaje del centro, cerrados por el sistema y profesores que no registran', () => {
    const resumen = resumenDeAsistencia([
      ...repetir(3, () => ocurrencia('REALIZADO', { profesorId: 1 })),
      ocurrencia('AUSENTE', { profesorId: 2 }),
      cerrado({ profesorId: 1 }),
      cerrado({ profesorId: 1 }),
      cerrado({ profesorId: 2 }),
      ocurrencia('SIN_REGISTRAR', { profesorId: 3 }),
      ocurrencia('CANCELADO', { profesorId: 4 }),
    ])

    expect(resumen).toMatchObject({
      porcentajeAsistencia: 75,
      cerradosSinRegistrar: 3,
      profesoresSinRegistrar: 2,
    })
  })

  it('base 0 → porcentaje 0 y todo en 0', () => {
    expect(resumenDeAsistencia([])).toEqual({
      porcentajeAsistencia: 0,
      cerradosSinRegistrar: 0,
      profesoresSinRegistrar: 0,
      alumnosBajoElUmbral: 0,
    })
  })

  describe('alumnos con menos de 75 % de asistencia', () => {
    it('el umbral es 75', () => {
      expect(UMBRAL_ASISTENCIA_ALUMNO).toBe(75)
    })

    it('cuenta los alumnos por debajo; exactamente 75 % no entra', () => {
      const resumen = resumenDeAsistencia([
        // Alumno 1: 3 de 4 = 75 % → no.
        ...repetir(3, () => ocurrencia('REALIZADO', { alumnoId: 1 })),
        ocurrencia('AUSENTE', { alumnoId: 1 }),
        // Alumno 2: 1 de 2 = 50 % → sí.
        ocurrencia('REALIZADO', { alumnoId: 2 }),
        ocurrencia('AUSENTE', { alumnoId: 2 }),
        // Alumno 3: 0 de 1 → sí.
        ocurrencia('AUSENTE', { alumnoId: 3 }),
        // Alumno 4: 100 % → no.
        ocurrencia('REALIZADO', { alumnoId: 4 }),
      ])

      expect(resumen.alumnosBajoElUmbral).toBe(2)
    })

    it('un porcentaje con decimales por debajo del umbral cuenta (2 de 3 = 66,7 %)', () => {
      const resumen = resumenDeAsistencia([
        ...repetir(2, () => ocurrencia('REALIZADO', { alumnoId: 1 })),
        ocurrencia('AUSENTE', { alumnoId: 1 }),
      ])

      expect(resumen.alumnosBajoElUmbral).toBe(1)
    })

    it('los alumnos sin ningún turno con asistencia registrada no entran', () => {
      const resumen = resumenDeAsistencia([
        cerrado({ alumnoId: 1 }),
        ocurrencia('SIN_REGISTRAR', { alumnoId: 2 }),
        ocurrencia('AGENDADO', { alumnoId: 3 }),
        ocurrencia('CANCELADO', { alumnoId: 4 }),
      ])

      expect(resumen.alumnosBajoElUmbral).toBe(0)
    })

    it('los cerrados y los pendientes de un alumno no bajan su porcentaje', () => {
      const resumen = resumenDeAsistencia([
        ocurrencia('REALIZADO', { alumnoId: 1 }),
        cerrado({ alumnoId: 1 }),
        cerrado({ alumnoId: 1 }),
      ])

      expect(resumen.alumnosBajoElUmbral).toBe(0)
    })
  })
})
