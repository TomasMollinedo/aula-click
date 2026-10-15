import type { HistorialDelAlumno, MiMateria, MiMateriaItem } from './historiales.validation'

// Ejemplos del OpenAPI de `historiales` (Swagger en /api/v1/docs), usados en historiales.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

const textos = {
  trabajado: 'Ecuaciones de primer grado',
  indicaciones: 'Practicar los ejercicios 4 a 10 de la guía',
}

export const ejemploHistorialDelAlumno = {
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
  desde: '2026-10-01',
  hasta: '2026-10-31',
  grupos: [
    {
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      resumen: { realizadas: 3, ausencias: 1, porcentaje: 75 },
      bloques: [
        {
          fecha: '2026-10-13',
          horaInicio: '08:00',
          horaFin: '10:00',
          horas: 2,
          textos,
          clases: [
            {
              turnoId: 31,
              fecha: '2026-10-13',
              horaInicio: '08:00',
              horaFin: '09:00',
              estado: 'REALIZADO',
              plazoAsistencia: { vence: '2026-10-20', vencido: false },
              cerradaPorSistema: false,
              textosPropios: null,
              observacion: null,
              cancelacion: null,
            },
            {
              turnoId: 32,
              fecha: '2026-10-13',
              horaInicio: '09:00',
              horaFin: '10:00',
              estado: 'REALIZADO',
              plazoAsistencia: { vence: '2026-10-20', vencido: false },
              cerradaPorSistema: false,
              textosPropios: {
                trabajado: 'Ecuaciones de primer grado y verificación',
                indicaciones: 'Practicar los ejercicios 4 a 10 de la guía',
              },
              observacion: null,
              cancelacion: null,
            },
          ],
        },
        {
          fecha: '2026-10-06',
          horaInicio: '08:00',
          horaFin: '09:00',
          horas: 1,
          textos: null,
          clases: [
            {
              turnoId: 31,
              fecha: '2026-10-06',
              horaInicio: '08:00',
              horaFin: '09:00',
              estado: 'AUSENTE',
              plazoAsistencia: { vence: '2026-10-13', vencido: true },
              cerradaPorSistema: false,
              textosPropios: null,
              observacion: 'Avisó la madre: estaba con fiebre',
              cancelacion: null,
            },
          ],
        },
      ],
    },
  ],
  opciones: {
    materias: [
      { id: 3, nombre: 'Matemática' },
      { id: 5, nombre: 'Lengua' },
    ],
    profesores: [
      { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      { id: 7, nombre: 'Diego', apellido: 'Ruiz' },
    ],
  },
} satisfies HistorialDelAlumno

export const ejemploMisMaterias = [
  {
    materia: { id: 3, nombre: 'Matemática' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    proximoTurno: { fecha: '2026-10-20', horaInicio: '08:00', horaFin: '09:00' },
    porcentaje: 75,
  },
  {
    materia: { id: 5, nombre: 'Lengua' },
    profesor: { id: 7, nombre: 'Diego', apellido: 'Ruiz' },
    proximoTurno: null,
    porcentaje: 100,
  },
] satisfies MiMateriaItem[]

export const ejemploMiMateria = {
  materia: { id: 3, nombre: 'Matemática' },
  profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
  mes: '2026-10',
  indicacionesProximaClase: {
    fecha: '2026-10-13',
    indicaciones: 'Practicar los ejercicios 4 a 10 de la guía',
  },
  resumen: { realizadas: 3, ausencias: 1, porcentaje: 75 },
  bloques: [
    {
      fecha: '2026-10-13',
      horaInicio: '08:00',
      horaFin: '10:00',
      horas: 2,
      textos,
      clases: [
        {
          turnoId: 31,
          fecha: '2026-10-13',
          horaInicio: '08:00',
          horaFin: '09:00',
          estado: 'REALIZADO',
          textosPropios: null,
        },
        {
          turnoId: 32,
          fecha: '2026-10-13',
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'REALIZADO',
          textosPropios: {
            trabajado: 'Ecuaciones de primer grado y verificación',
            indicaciones: 'Practicar los ejercicios 4 a 10 de la guía',
          },
        },
      ],
    },
  ],
} satisfies MiMateria
