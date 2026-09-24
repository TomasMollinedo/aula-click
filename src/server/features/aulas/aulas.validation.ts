import { z } from '@hono/zod-openapi'
import type { Estado } from '@/server/shared/estado'
import { diaSemanaQuery, horaHHmm, rangoHorasEnPunto } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.
// El formato del horario es el mismo que el del alta de bloques: sale de `shared/zod.ts`.

/**
 * Query de las aulas disponibles: día y rango de horas en punto, con el fin posterior al inicio
 * (igual que el alta de bloques). `excluirBloqueId` es para la edición: la propia fila no ocupa
 * su aula.
 */
export const aulasDisponiblesQuerySchema = z
  .object({
    diaSemana: diaSemanaQuery.openapi({ param: { name: 'diaSemana', in: 'query' } }),
    horaInicio: horaHHmm.openapi({
      param: { name: 'horaInicio', in: 'query' },
      example: '14:00',
    }),
    horaFin: horaHHmm.openapi({ param: { name: 'horaFin', in: 'query' }, example: '18:00' }),
    excluirBloqueId: z.coerce
      .number({ error: 'Debe ser un número' })
      .int({ error: 'Debe ser un número entero' })
      .positive({ error: 'Debe ser mayor a 0' })
      .optional()
      .openapi({
        param: { name: 'excluirBloqueId', in: 'query' },
        description: 'Fila que no cuenta como ocupación (la que se está editando)',
        example: 10,
      }),
  })
  .superRefine(rangoHorasEnPunto({ finPosterior: true }))

export type AulasDisponiblesQuery = z.infer<typeof aulasDisponiblesQuerySchema>

/** Ítem del selector de aulas disponibles. */
export const aulaDisponibleSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    capacidad: z.number().int().openapi({ example: 10 }),
  })
  .openapi('AulaDisponible')

export type AulaDisponible = z.infer<typeof aulaDisponibleSchema>

export const aulasDisponiblesSchema = z.array(aulaDisponibleSchema)

/** Un aula del catálogo con su estado, tal como la lee el repository. No viaja por HTTP. */
export type AulaGuardada = AulaDisponible & { estado: Estado }
