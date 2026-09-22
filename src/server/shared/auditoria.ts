import { z } from '@hono/zod-openapi'

// Auditoría en el detalle de toda entidad (docs/convenciones-backend.md → Auditoría y Actor).
// Los instantes viajan como ISO 8601 en UTC (docs/contrato-api.md → Formatos).

/** Usuario que creó o modificó un registro. Componente OpenAPI `UsuarioAuditoria`. */
export const usuarioAuditoriaSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    apellido: z.string(),
  })
  .openapi('UsuarioAuditoria', {
    example: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
  })

/** `{ id, nombre, apellido }` del usuario de auditoría. */
export type UsuarioAuditoria = z.infer<typeof usuarioAuditoriaSchema>

const instante = z.iso.datetime().openapi({
  description: 'Instante ISO 8601 en UTC',
  example: '2026-09-22T13:45:00.000Z',
})

const usuarioAuditoria = (accion: string) =>
  usuarioAuditoriaSchema.nullable().openapi({
    description: `Usuario que ${accion} el registro. \`null\` solo si lo creó el seed (caso de \`Usuario\`)`,
  })

/**
 * Campos de auditoría del detalle: `{ createdAt, updatedAt, createdBy, updatedBy }`.
 * Se mezcla plano en el schema de cada entidad:
 *
 * ```ts
 * const alumnoDetalleSchema = z
 *   .object({ id: z.number(), nombre: z.string(), ...auditoriaSchema.shape })
 *   .openapi('AlumnoDetalle')
 * ```
 */
export const auditoriaSchema = z.object({
  createdAt: instante,
  updatedAt: instante,
  createdBy: usuarioAuditoria('creó'),
  updatedBy: usuarioAuditoria('modificó por última vez'),
})

/** Campos de auditoría ya armados para la respuesta. */
export type Auditoria = z.infer<typeof auditoriaSchema>

/**
 * `select` de Prisma para los usuarios de auditoría (objeto plano: `shared` no importa Prisma).
 * Uso en un repository: `include: { createdBy: { select: SELECT_USUARIO_AUDITORIA }, updatedBy: { select: SELECT_USUARIO_AUDITORIA } }`.
 */
export const SELECT_USUARIO_AUDITORIA = { id: true, nombre: true, apellido: true } as const

/** Lo mínimo que tiene que traer una fila para armar su auditoría (tipo estructural, no de Prisma). */
export type FilaAuditable = {
  createdAt: Date
  updatedAt: Date
  createdBy: UsuarioAuditoria | null
  updatedBy: UsuarioAuditoria | null
}

function instanteISO(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Fecha inválida: Invalid Date')
  return date.toISOString()
}

function copiarUsuario(usuario: UsuarioAuditoria | null): UsuarioAuditoria | null {
  return usuario && { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido }
}

/**
 * Fila con auditoría → `Auditoria` (instantes en ISO UTC). Los demás campos de la fila se ignoran.
 * Lanza `RangeError` si `createdAt` o `updatedAt` es un `Invalid Date`.
 */
export function armarAuditoria(fila: FilaAuditable): Auditoria {
  return {
    createdAt: instanteISO(fila.createdAt),
    updatedAt: instanteISO(fila.updatedAt),
    createdBy: copiarUsuario(fila.createdBy),
    updatedBy: copiarUsuario(fila.updatedBy),
  }
}
