import { z } from '@hono/zod-openapi'
import { metaPaginacionSchema } from '@/server/shared/paginacion'
import { fechaISO, mesISO } from '@/server/shared/zod'
import {
  COLUMNAS_FINANZAS,
  COLUMNAS_PROFESORES,
  FILAS_POR_PAGINA_ASISTENCIA,
  MAX_DIAS_TABLERO,
  MAX_MATERIAS_TABLERO,
  MAX_PROFESORES_TABLERO,
  MESES_EVOLUCION,
  ORDEN_FINANZAS_POR_DEFECTO,
  ORDEN_PROFESORES_POR_DEFECTO,
  UMBRAL_ASISTENCIA_ALUMNO,
  problemaDelPeriodo,
} from './tablero.reglas'

// Schemas Zod del query y de la respuesta del tablero del gerente (HU-21, T-61). Son la fuente del
// OpenAPI. Sin reglas de negocio: qué cuenta cada indicador lo deciden `tablero.reglas.ts`, el
// motor de ocurrencias y las condiciones de `cuentas` y `pagos`. Estados en código y números sin
// formato (ni pesos ni `%`): los textos los pone la UI.

const periodoShape = {
  desde: fechaISO.openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del período, incluido (YYYY-MM-DD)',
    example: '2026-09-28',
  }),
  hasta: fechaISO.openapi({
    param: { name: 'hasta', in: 'query' },
    description: `Último día del período, incluido (YYYY-MM-DD). No puede ser anterior a \`desde\` ni quedar a más de ${MAX_DIAS_TABLERO} días (extremos incluidos)`,
    example: '2026-10-04',
  }),
}

/**
 * Valida el período de un query que lo trae (`desde` y `hasta`): `hasta` no puede ser anterior a
 * `desde` ni el período superar `MAX_DIAS_TABLERO` días, con `details` sobre `hasta`. Es el mismo
 * criterio para todos los endpoints del tablero. Se valida acá y no en el service porque ningún
 * extremo tiene un default que dependa de hoy.
 */
function validarPeriodo(
  datos: { desde: string; hasta: string },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: string[] }) => void },
) {
  // Si alguna fecha ya es inválida, la reporta `fechaISO` en su campo.
  if (!fechaISO.safeParse(datos.desde).success || !fechaISO.safeParse(datos.hasta).success) return
  const problema = problemaDelPeriodo(datos.desde, datos.hasta)
  if (problema !== null) ctx.addIssue({ code: 'custom', message: problema, path: ['hasta'] })
}

/**
 * Query de `GET /tablero`: el período es **obligatorio** (la UI siempre traduce "Hoy", "Esta
 * semana", "Este mes" o un rango).
 */
export const tableroQuerySchema = z.object(periodoShape).superRefine(validarPeriodo)

export type TableroQuery = z.infer<typeof tableroQuerySchema>

const PORCENTAJE =
  'número de 0 a 100 redondeado a un decimal; 0 si la base es 0. Los porcentajes no se ajustan para que sumen 100'

const conteoSchema = z
  .object({
    cantidad: z.number().int().min(0),
    porcentaje: z.number().openapi({
      description: `Sobre \`turnos.total\`: ${PORCENTAJE}`,
      example: 33.3,
    }),
  })
  .openapi('TableroConteo')

const conteoAsistenciaSchema = z
  .object({
    cantidad: z.number().int().min(0),
    porcentaje: z.number().openapi({
      description: `Sobre los turnos con asistencia registrada (\`asistio\` + \`noAsistio\`), no sobre \`turnos.total\`: ${PORCENTAJE}`,
      example: 87.5,
    }),
  })
  .openapi('TableroConteoAsistencia')

const importe = (description: string, example: number) =>
  z.number().openapi({ description, example })

/** Respuesta de `GET /tablero`: sólo agregados del período, nunca datos de un alumno o un pago. */
export const tableroSchema = z
  .object({
    periodo: z.object({ desde: fechaISO, hasta: fechaISO }).openapi({
      description: 'El período pedido, extremos incluidos',
    }),
    hoy: fechaISO.openapi({
      description:
        'Fecha de hoy en la zona del negocio: la fecha a la que corresponde `pagos.totalAdeudado` y la que separa "sin registrar" de "agendados"',
      example: '2026-10-02',
    }),
    turnos: z.object({
      total: z.number().int().min(0).openapi({
        description: 'Ocurrencias del período, incluidas las canceladas',
      }),
      cancelados: conteoSchema,
      sinRegistrar: conteoSchema.openapi({
        description: 'Pasados y no cancelados (la asistencia todavía no se registra)',
      }),
      agendados: conteoSchema.nullable().openapi({
        description:
          'No cancelados de hoy en adelante. **`null` si el período no incluye fechas futuras** (`hasta` anterior a `hoy`); si las incluye, viene con su cantidad, que puede ser 0',
      }),
      asistio: conteoAsistenciaSchema.openapi({
        description: 'Turnos con asistencia "Presente" (estado `REALIZADO`)',
      }),
      noAsistio: conteoAsistenciaSchema.openapi({
        description: 'Turnos con asistencia "Ausente" (estado `AUSENTE`)',
      }),
    }),
    ocupacion: z.object({
      turnos: z.number().int().min(0).openapi({
        description: 'Ocurrencias no canceladas del período',
      }),
      capacidad: z.number().int().min(0).openapi({
        description:
          'Suma de la capacidad efectiva (`min(profesor.capacidad, aula.capacidad)`, leída al consultar) de cada clase: una hora de un bloque en una fecha con al menos un turno no cancelado. Las horas sin turnos no cuentan',
      }),
      porcentaje: z.number().openapi({
        description: `\`turnos\` sobre \`capacidad\`: ${PORCENTAJE}. **No se recorta a 100**`,
        example: 62.5,
      }),
    }),
    alumnos: z.object({
      nuevos: z.number().int().min(0).openapi({
        description:
          'Alumnos dados de alta en el período (en hora de Salta), aunque después se hayan dado de baja',
      }),
      atendidos: z.number().int().min(0).openapi({
        description:
          'Alumnos distintos con al menos un turno `REALIZADO` (asistencia "Presente") en el período',
      }),
    }),
    materiasConMasDemanda: z
      .array(
        z.object({
          materia: z.object({ id: z.number().int(), nombre: z.string() }),
          cantidad: z.number().int().min(1),
        }),
      )
      .max(MAX_MATERIAS_TABLERO)
      .openapi({
        description: `Hasta ${MAX_MATERIAS_TABLERO} materias por cantidad de turnos no cancelados del período (descendente; en empate, por nombre). Vacío si no hay ninguno`,
      }),
    profesoresConMasTurnos: z
      .array(
        z.object({
          profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
          cantidad: z.number().int().min(1),
        }),
      )
      .max(MAX_PROFESORES_TABLERO)
      .openapi({
        description: `Hasta ${MAX_PROFESORES_TABLERO} profesores por cantidad de turnos no cancelados del período, es decir, por alumnos con turno en sus horas (descendente; en empate, por apellido y nombre). Vacío si no hay ninguno`,
      }),
    pagos: z.object({
      totalCobrado: z.number().openapi({
        description:
          'Suma de los pagos vigentes (sin los anulados) con fecha de pago dentro del período, en pesos (número JSON)',
        example: 96000,
      }),
      cobradoPorForma: z
        .object({
          EFECTIVO: importe('Cobrado en efectivo', 40000),
          TRANSFERENCIA: importe('Cobrado por transferencia', 38000),
          DEBITO: importe('Cobrado con tarjeta de débito', 18000),
        })
        .openapi({
          description:
            '`totalCobrado` separado por forma de pago (por su código, nunca por el nombre), en pesos. Sólo pagos vigentes: las tres suman `totalCobrado`. 0 si no hubo cobros de esa forma',
        }),
      totalAdeudado: z.number().openapi({
        description:
          'Total adeudado **a la fecha (`hoy`), no del período**: el mismo número que `totalAdeudado` de `GET /cuentas/adeudados` sin filtros',
        example: 296000.5,
      }),
    }),
  })
  .openapi('Tablero')

export type Tablero = z.infer<typeof tableroSchema>

// ---------------------------------------------------------------------------------------------
// Pestaña "Asistencia" y PDF por sección (HU-39, T-112)
// ---------------------------------------------------------------------------------------------

const paginaQuery = (name: string, description: string) =>
  z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .min(1, { error: 'Debe ser mayor o igual a 1' })
    .default(1)
    .openapi({ param: { name, in: 'query' }, description, example: 1 })

/**
 * Query de `GET /tablero/asistencia`: el mismo período (obligatorio y con las mismas validaciones)
 * más lo de la tabla de profesores. Las dos tablas son de a `FILAS_POR_PAGINA_ASISTENCIA` filas, sin
 * `pageSize`; cada una tiene su página.
 */
export const tableroAsistenciaQuerySchema = z
  .object({
    ...periodoShape,
    paginaProfesores: paginaQuery('paginaProfesores', 'Página de la tabla de profesores (desde 1)'),
    paginaMaterias: paginaQuery('paginaMaterias', 'Página de la tabla de materias (desde 1)'),
    orden: z
      .enum(COLUMNAS_PROFESORES)
      .default(ORDEN_PROFESORES_POR_DEFECTO.orden)
      .openapi({
        param: { name: 'orden', in: 'query' },
        description: `Columna por la que se ordena la tabla de profesores (por defecto \`${ORDEN_PROFESORES_POR_DEFECTO.orden}\`). \`profesor\` ordena por apellido y nombre. En empate, siempre apellido, nombre e id ascendentes. La tabla de materias no se reordena`,
        example: 'cerradosSinRegistrar',
      }),
    direccion: z
      .enum(['asc', 'desc'])
      .default(ORDEN_PROFESORES_POR_DEFECTO.direccion)
      .openapi({
        param: { name: 'direccion', in: 'query' },
        description: `Dirección de \`orden\` (por defecto \`${ORDEN_PROFESORES_POR_DEFECTO.direccion}\`)`,
        example: 'desc',
      }),
    soloSinRegistrar: z
      .enum(['true', 'false'])
      .optional()
      .openapi({
        param: { name: 'soloSinRegistrar', in: 'query' },
        description:
          'Con `true`, la tabla de profesores trae sólo a los que tienen al menos un turno cerrado sin registrar (`noRegistraAsistencia`). No cambia el resumen ni la tabla de materias',
        example: 'true',
      }),
  })
  .superRefine(validarPeriodo)

export type TableroAsistenciaQuery = z.infer<typeof tableroAsistenciaQuerySchema>

/** Secciones del tablero que se pueden pedir en PDF. */
export const SECCIONES_TABLERO = ['general', 'asistencia', 'finanzas'] as const
export type SeccionTablero = (typeof SECCIONES_TABLERO)[number]

/**
 * Query de `GET /tablero/pdf`: el período de siempre y la sección (`general` por defecto, así el
 * enlace anterior a las secciones sigue funcionando).
 */
export const tableroPdfQuerySchema = z
  .object({
    ...periodoShape,
    seccion: z
      .enum(SECCIONES_TABLERO)
      .default('general')
      .openapi({
        param: { name: 'seccion', in: 'query' },
        description:
          'Sección del tablero: `general` (por defecto), `asistencia` o `finanzas`. Los PDF de asistencia y de finanzas traen las tablas completas, no una página',
        example: 'asistencia',
      }),
  })
  .superRefine(validarPeriodo)

export type TableroPdfQuery = z.infer<typeof tableroPdfQuerySchema>

const cifrasAsistenciaShape = {
  clasesRealizadas: z.number().int().min(0).openapi({
    description:
      'Turnos con asistencia "Presente" (`REALIZADO`): cada hora de un alumno es un turno',
  }),
  ausencias: z.number().int().min(0).openapi({ description: 'Turnos con asistencia "Ausente"' }),
  porcentajeAsistencia: z.number().openapi({
    description: `\`clasesRealizadas\` sobre los turnos con asistencia registrada (\`clasesRealizadas\` + \`ausencias\`): ${PORCENTAJE}`,
    example: 87.5,
  }),
  cerradosSinRegistrar: z.number().int().min(0).openapi({
    description:
      'Turnos "Sin registrar" cuyo plazo de 7 días venció: los cerró el sistema. Es lo que muestra que el profesor no registra',
  }),
  dentroDelPlazo: z.number().int().min(0).openapi({
    description: 'Turnos "Sin registrar" que todavía se pueden registrar (plazo vigente)',
  }),
  porcentajeSinRegistrar: z.number().openapi({
    description: `\`cerradosSinRegistrar\` sobre los turnos **no cancelados** del período del profesor o la materia (los agendados están en la base): ${PORCENTAJE}`,
    example: 12.5,
  }),
}

const profesorAsistenciaSchema = z
  .object({
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    ...cifrasAsistenciaShape,
    noRegistraAsistencia: z.boolean().openapi({
      description: 'Tiene al menos un turno cerrado sin registrar en el período',
    }),
  })
  .openapi('TableroAsistenciaProfesor')

const materiaAsistenciaSchema = z
  .object({
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    ...cifrasAsistenciaShape,
  })
  .openapi('TableroAsistenciaMateria')

const tablaPaginada = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: metaPaginacionSchema })

/**
 * Respuesta de `GET /tablero/asistencia`: sólo agregados por centro, profesor y materia; nunca un
 * alumno con nombre.
 */
export const tableroAsistenciaSchema = z
  .object({
    periodo: z.object({ desde: fechaISO, hasta: fechaISO }).openapi({
      description: 'El período pedido, extremos incluidos',
    }),
    hoy: fechaISO.openapi({
      description:
        'Fecha de hoy en la zona del negocio con la que se calculó la respuesta: decide qué turnos tienen el plazo de registro vencido',
      example: '2026-10-02',
    }),
    resumen: z.object({
      porcentajeAsistencia: z.number().openapi({
        description: `Asistencia del centro: turnos \`REALIZADO\` sobre los que tienen asistencia registrada: ${PORCENTAJE}`,
        example: 84.6,
      }),
      cerradosSinRegistrar: z.number().int().min(0).openapi({
        description: 'Turnos del período cerrados "Sin registrar" por el sistema',
      }),
      profesoresSinRegistrar: z.number().int().min(0).openapi({
        description: 'Profesores con al menos un turno cerrado sin registrar en el período',
      }),
      alumnosBajoElUmbral: z
        .number()
        .int()
        .min(0)
        .openapi({
          description: `Alumnos con menos de ${UMBRAL_ASISTENCIA_ALUMNO} % de asistencia, entre los que tienen algún turno con asistencia registrada en el período. Sólo la cantidad: nunca se listan alumnos`,
        }),
    }),
    profesores: tablaPaginada(profesorAsistenciaSchema).openapi({
      description: `Un profesor por fila, de a ${FILAS_POR_PAGINA_ASISTENCIA}. Sólo profesores con turnos no cancelados en el período. Por defecto, los que más turnos cerrados sin registrar tienen primero`,
    }),
    materias: tablaPaginada(materiaAsistenciaSchema).openapi({
      description: `Una materia por fila, de a ${FILAS_POR_PAGINA_ASISTENCIA}: las mismas cifras que los profesores, sin \`noRegistraAsistencia\`. Orden fijo: cerrados sin registrar de mayor a menor y, en empate, nombre`,
    }),
  })
  .openapi('TableroAsistencia')

export type TableroAsistencia = z.infer<typeof tableroAsistenciaSchema>

/**
 * La pestaña "Asistencia" con las tablas **completas** (sin filtro ni páginas), en el orden por
 * defecto: es lo que lleva el PDF. No es una respuesta de la API.
 */
export type TableroAsistenciaCompleta = Omit<TableroAsistencia, 'profesores' | 'materias'> & {
  profesores: TableroAsistencia['profesores']['data']
  materias: TableroAsistencia['materias']['data']
}

// ---------------------------------------------------------------------------------------------
// Pestaña "Finanzas" (HU-47, T-128)
// ---------------------------------------------------------------------------------------------

/**
 * Query de `GET /tablero/finanzas`: el mismo período (obligatorio y con las mismas validaciones)
 * más la página y el orden de la tabla por profesor, de a `FILAS_POR_PAGINA_ASISTENCIA` filas.
 */
export const tableroFinanzasQuerySchema = z
  .object({
    ...periodoShape,
    page: paginaQuery('page', 'Página de la tabla por profesor (desde 1)'),
    orden: z
      .enum(COLUMNAS_FINANZAS)
      .default(ORDEN_FINANZAS_POR_DEFECTO.orden)
      .openapi({
        param: { name: 'orden', in: 'query' },
        description: `Columna por la que se ordena la tabla por profesor (por defecto \`${ORDEN_FINANZAS_POR_DEFECTO.orden}\`). \`profesor\` ordena por apellido y nombre. En empate, siempre apellido, nombre e id ascendentes. La evolución mensual no se reordena`,
        example: 'totalCobrado',
      }),
    direccion: z
      .enum(['asc', 'desc'])
      .default(ORDEN_FINANZAS_POR_DEFECTO.direccion)
      .openapi({
        param: { name: 'direccion', in: 'query' },
        description: `Dirección de \`orden\` (por defecto \`${ORDEN_FINANZAS_POR_DEFECTO.direccion}\`)`,
        example: 'desc',
      }),
  })
  .superRefine(validarPeriodo)

export type TableroFinanzasQuery = z.infer<typeof tableroFinanzasQuerySchema>

const profesorFinanzasSchema = z
  .object({
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    turnosCobrados: z.number().int().min(0).openapi({
      description: 'Turnos del profesor cobrados en el período (por fecha de pago, sin anulados)',
    }),
    totalCobrado: importe('Lo cobrado de esos turnos', 80000),
    parteCentro: importe(
      'La parte del centro de esos cobros. Un turno cerrado sin registrar va **entero** acá (no se le debe al profesor): así la columna suma `resumen.margenCentro.importe`',
      12000,
    ),
    parteProfesor: importe(
      'La parte del profesor de esos cobros (0 en los cerrados sin registrar). Con `parteCentro`, suma `totalCobrado`',
      68000,
    ),
    pagado: importe(
      'Lo transferido al profesor en el período: el total de sus liquidaciones pagadas con fecha de transferencia en el período',
      40800,
    ),
    saldoPendiente: importe(
      'Lo que se le debe **a hoy** (no depende del período). **Puede ser negativo** (un saldo a descontar)',
      27200,
    ),
  })
  .openapi('TableroFinanzasProfesor')

const mesFinanzasSchema = z
  .object({
    mes: mesISO.openapi({ description: 'Mes `YYYY-MM`', example: '2026-10' }),
    totalCobrado: importe('Lo cobrado en el mes, por fecha de pago, sin anulados', 128000),
    margenCentro: importe(
      'La parte del centro de esos cobros, con los cerrados sin registrar enteros',
      26000,
    ),
    pagadoAProfesores: importe(
      'Las liquidaciones pagadas con fecha de transferencia en el mes',
      40800,
    ),
  })
  .openapi('TableroFinanzasMes')

/**
 * Respuesta de `GET /tablero/finanzas`: sólo agregados del centro, por profesor y por mes; nunca un
 * alumno ni un pago puntual.
 */
export const tableroFinanzasSchema = z
  .object({
    periodo: z.object({ desde: fechaISO, hasta: fechaISO }).openapi({
      description: 'El período pedido, extremos incluidos',
    }),
    hoy: fechaISO.openapi({
      description:
        'Fecha de hoy en la zona del negocio: la del saldo a pagar a los profesores y la que decide qué turnos cobrados quedaron cerrados sin registrar',
      example: '2026-10-15',
    }),
    resumen: z.object({
      totalCobrado: importe(
        'Suma de los pagos vigentes con fecha de pago dentro del período: el mismo número que `pagos.totalCobrado` de `GET /tablero`',
        128000,
      ),
      margenCentro: z
        .object({
          importe: importe(
            'La parte del centro de los turnos cobrados en el período más el importe **completo** de los cobrados y cerrados sin registrar (no se le deben al profesor)',
            26000,
          ),
          porcentaje: z.number().openapi({
            description: `\`importe\` sobre \`totalCobrado\`: ${PORCENTAJE}`,
            example: 20.3,
          }),
        })
        .openapi({ description: 'Margen del centro en el período' }),
      incluyeSinRegistrar: importe(
        'Cuánto de `margenCentro.importe` son turnos cobrados y cerrados sin registrar (su importe completo); 0 si no hay. La UI arma el aviso',
        8000,
      ),
      pagadoAProfesores: importe(
        'Suma de las liquidaciones pagadas con fecha de transferencia dentro del período (las descontadas no son transferencias)',
        40800,
      ),
      saldoAPagarAProfesores: importe(
        'Lo que se les debe a los profesores **a hoy** (no depende del período): la suma de los `saldoPendiente` **positivos**. Un profesor con saldo negativo no lo resta',
        47600,
      ),
    }),
    profesores: tablaPaginada(profesorFinanzasSchema).openapi({
      description: `Un profesor por fila, de a ${FILAS_POR_PAGINA_ASISTENCIA}: los que tienen cobros o pagos en el período o un saldo distinto de 0 a hoy, activos o inactivos. Por defecto, los que más cobraron primero`,
    }),
    evolucion: z
      .array(mesFinanzasSchema)
      .length(MESES_EVOLUCION)
      .openapi({
        description: `Los últimos ${MESES_EVOLUCION} meses hasta el de \`hasta\`, del más viejo al más nuevo, sin paginar. Los anteriores son completos; **el último llega hasta \`hasta\`**. Un mes sin movimientos va en 0`,
      }),
  })
  .openapi('TableroFinanzas')

export type TableroFinanzas = z.infer<typeof tableroFinanzasSchema>

/**
 * La pestaña "Finanzas" con la tabla por profesor **completa** (sin páginas), en el orden por
 * defecto: es lo que lleva el PDF. No es una respuesta de la API.
 */
export type TableroFinanzasCompleta = Omit<TableroFinanzas, 'profesores'> & {
  profesores: TableroFinanzas['profesores']['data']
}
