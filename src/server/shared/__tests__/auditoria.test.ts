import { createRoute, z } from '@hono/zod-openapi'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createRouter } from '@/server/router'
import {
  armarAuditoria,
  auditoriaSchema,
  SELECT_USUARIO_AUDITORIA,
  type Auditoria,
} from '../auditoria'

const ana = { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' }
const luis = { id: 'usr_2', nombre: 'Luis', apellido: 'Gómez' }

const auditoriaValida: Auditoria = {
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:00:00.000Z',
  createdBy: ana,
  updatedBy: luis,
}

describe('armarAuditoria', () => {
  it('convierte los Date a ISO UTC y copia los usuarios', () => {
    expect(
      armarAuditoria({
        createdAt: new Date('2026-09-22T10:45:00-03:00'),
        updatedAt: new Date('2026-09-23T10:00:00Z'),
        createdBy: ana,
        updatedBy: luis,
      }),
    ).toEqual(auditoriaValida)
  })

  it('con createdBy null devuelve null (registro creado por el seed)', () => {
    const auditoria = armarAuditoria({
      createdAt: new Date('2026-09-22T13:45:00Z'),
      updatedAt: new Date('2026-09-22T13:45:00Z'),
      createdBy: null,
      updatedBy: null,
    })
    expect(auditoria.createdBy).toBeNull()
    expect(auditoria.updatedBy).toBeNull()
  })

  it('ignora los campos extra de la fila y de los usuarios', () => {
    const fila = {
      id: 7,
      dni: '30123456',
      createdById: 'usr_1',
      createdAt: new Date('2026-09-22T13:45:00Z'),
      updatedAt: new Date('2026-09-23T10:00:00Z'),
      createdBy: { ...ana, email: 'ana@mail.com' },
      updatedBy: luis,
    }
    expect(armarAuditoria(fila)).toStrictEqual(auditoriaValida)
  })

  it.each(['createdAt', 'updatedAt'] as const)('lanza RangeError con %s Invalid Date', (campo) => {
    const fila = {
      createdAt: new Date('2026-09-22T13:45:00Z'),
      updatedAt: new Date('2026-09-22T13:45:00Z'),
      createdBy: ana,
      updatedBy: ana,
      [campo]: new Date(Number.NaN),
    }
    expect(() => armarAuditoria(fila)).toThrow(RangeError)
  })

  it('su salida cumple auditoriaSchema', () => {
    const auditoria = armarAuditoria({
      createdAt: new Date('2026-09-22T13:45:00Z'),
      updatedAt: new Date('2026-09-22T13:45:00Z'),
      createdBy: ana,
      updatedBy: null,
    })
    expect(auditoriaSchema.parse(auditoria)).toEqual(auditoria)
  })
})

describe('auditoriaSchema', () => {
  it('acepta un objeto válido, con usuarios o con null', () => {
    expect(auditoriaSchema.parse(auditoriaValida)).toEqual(auditoriaValida)
    expect(
      auditoriaSchema.safeParse({ ...auditoriaValida, createdBy: null, updatedBy: null }).success,
    ).toBe(true)
  })

  it.each(['2026-09-22', '22/09/2026 13:45', '2026-09-22T13:45:00-03:00', ''])(
    'rechaza un createdAt que no es ISO UTC (%o)',
    (createdAt) => {
      expect(auditoriaSchema.safeParse({ ...auditoriaValida, createdAt }).success).toBe(false)
    },
  )

  it('rechaza un usuario incompleto', () => {
    const createdBy = { id: 'usr_1', nombre: 'Ana' }
    expect(auditoriaSchema.safeParse({ ...auditoriaValida, createdBy }).success).toBe(false)
  })

  it('se mezcla plano con .shape en otro z.object', () => {
    const detalleSchema = z.object({ id: z.number(), nombre: z.string(), ...auditoriaSchema.shape })
    const detalle = { id: 1, nombre: 'Matemática', ...auditoriaValida }
    expect(detalleSchema.parse(detalle)).toEqual(detalle)
    expect(detalleSchema.safeParse({ id: 1, nombre: 'Matemática' }).success).toBe(false)
    expectTypeOf<z.infer<typeof detalleSchema>>().toEqualTypeOf<{
      id: number
      nombre: string
      createdAt: string
      updatedAt: string
      createdBy: { id: string; nombre: string; apellido: string } | null
      updatedBy: { id: string; nombre: string; apellido: string } | null
    }>()
  })
})

describe('auditoriaSchema en el OpenAPI', () => {
  const app = createRouter()
  app.openapi(
    createRoute({
      method: 'get',
      path: '/x',
      responses: {
        200: {
          description: 'Detalle',
          content: { 'application/json': { schema: z.object({ ...auditoriaSchema.shape }) } },
        },
      },
    }),
    (c) => c.json(auditoriaValida, 200),
  )
  const documento = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'test', version: '1' },
  })

  it('registra el componente UsuarioAuditoria y lo referencia desde el detalle', () => {
    expect(documento.components?.schemas).toHaveProperty('UsuarioAuditoria')
    expect(JSON.stringify(documento.paths)).toContain('#/components/schemas/UsuarioAuditoria')
  })
})

describe('SELECT_USUARIO_AUDITORIA', () => {
  it('selecciona id, nombre y apellido', () => {
    expect(SELECT_USUARIO_AUDITORIA).toEqual({ id: true, nombre: true, apellido: true })
  })
})
