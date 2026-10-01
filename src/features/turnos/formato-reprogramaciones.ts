import { fechaConDia } from '@/utils/formato-fechas'
import { horaCorta } from '@/utils/horas'

// Presentación de la reprogramación (HU-20). Sin reglas: qué se puede mover y a dónde lo decide la
// API. Las fechas son `YYYY-MM-DD` y se leen con `parseISO` (hora local).

export type LugarDeTurno = {
  fecha: string
  horaInicio: string
  horaFin: string
  profesor: { apellido: string }
}

function textoLugar({ fecha, horaInicio, horaFin, profesor }: LugarDeTurno): string {
  return `${fechaConDia(fecha)} ${horaCorta(horaInicio)}–${horaCorta(horaFin)} con Prof. ${profesor.apellido}`
}

/**
 * El cambio que se le muestra a la persona antes de confirmar (HU-20): `'Del lunes 12/10
 * 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz'`.
 */
export function textoCambio(origen: LugarDeTurno, destino: LugarDeTurno): string {
  return `Del ${textoLugar(origen)} al ${textoLugar(destino)}`
}
