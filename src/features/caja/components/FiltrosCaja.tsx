'use client'

import { useId } from 'react'

import { BarraFiltros, claseControlFiltro } from '@/components/ui/barra-filtros'
import { Field, fieldErrorId } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  CODIGOS_FORMA_PAGO,
  TIPOS_MOVIMIENTO,
  type CodigoFormaPago,
  type TipoMovimiento,
} from '../caja.types'
import type { CampoCaja } from '../errores-caja'
import type { FiltrosCaja as Filtros } from '../filtros-caja'
import { NOMBRE_FORMA_PAGO, NOMBRE_TIPO_MOVIMIENTO } from '../formato-caja'

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODOS = 'TODOS'

type FiltrosCajaProps = {
  filtros: Filtros
  onCambiar: (cambios: Partial<Filtros>) => void
  onLimpiar: () => void
  puedeLimpiar: boolean
  /** El 400 de la API por campo (`interpretarErrorCaja`): un `tipo` o una `formaPago` que no existen. */
  errores?: Partial<Record<CampoCaja, string>>
}

/**
 * Los filtros de la lista de movimientos de la caja (HU-46): tipo y forma de pago. **Sólo recortan
 * la lista**: el resumen es siempre el del día completo, así que limpiarlos no cambia los totales.
 * No guarda estado: muestra los de la URL y avisa cada cambio, que se aplica enseguida. El día no
 * es un filtro (va en la navegación de fecha) y "Limpiar filtros" no lo toca.
 */
export function FiltrosCaja({
  filtros,
  onCambiar,
  onLimpiar,
  puedeLimpiar,
  errores = {},
}: FiltrosCajaProps) {
  const id = useId()
  const ids = { tipo: `${id}-tipo`, formaPago: `${id}-forma-pago` }
  const aria = (campo: CampoCaja, idCampo: string) =>
    errores[campo]
      ? { 'aria-invalid': true, 'aria-describedby': fieldErrorId(idCampo) }
      : { 'aria-invalid': undefined, 'aria-describedby': undefined }

  return (
    <BarraFiltros
      hayFiltros={puedeLimpiar}
      onLimpiar={onLimpiar}
      limpiarEnFila="md"
      className="sm:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,1fr))_auto]"
    >
      <Field label="Tipo" htmlFor={ids.tipo} error={errores.tipo}>
        <Select
          value={filtros.tipo ?? TODOS}
          onValueChange={(valor) =>
            onCambiar({ tipo: valor === TODOS ? null : (valor as TipoMovimiento) })
          }
        >
          <SelectTrigger
            id={ids.tipo}
            className={claseControlFiltro(filtros.tipo === null)}
            {...aria('tipo', ids.tipo)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {TIPOS_MOVIMIENTO.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {NOMBRE_TIPO_MOVIMIENTO[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Forma de pago" htmlFor={ids.formaPago} error={errores.formaPago}>
        <Select
          value={filtros.formaPago ?? TODOS}
          onValueChange={(valor) =>
            onCambiar({ formaPago: valor === TODOS ? null : (valor as CodigoFormaPago) })
          }
        >
          <SelectTrigger
            id={ids.formaPago}
            className={claseControlFiltro(filtros.formaPago === null)}
            {...aria('formaPago', ids.formaPago)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {CODIGOS_FORMA_PAGO.map((codigo) => (
              <SelectItem key={codigo} value={codigo}>
                {NOMBRE_FORMA_PAGO[codigo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </BarraFiltros>
  )
}
