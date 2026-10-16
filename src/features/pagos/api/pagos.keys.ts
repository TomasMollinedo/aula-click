import type {
  BuscadorAcotadoParams,
  BuscadorPagosParams,
  ListarPagosRealizadosParams,
} from '../pagos-realizados.types'

// Todo cuelga de `all`: registrar o anular un pago invalida `all`. El adjunto cuelga del detalle de
// su pago: reemplazarlo o quitarlo invalida ese detalle, y con él su adjunto. Los pagos realizados
// y los buscadores de sus filtros también cuelgan de `all`: registrar, anular, reemplazar o quitar
// los vuelven a pedir.
export const pagosKeys = {
  all: ['pagos'] as const,
  detalle: (pagoId: number) => [...pagosKeys.all, 'detalle', pagoId] as const,
  adjunto: (pagoId: number) => [...pagosKeys.detalle(pagoId), 'adjunto'] as const,
  realizados: (params: ListarPagosRealizadosParams) =>
    [...pagosKeys.all, 'realizados', params] as const,
  buscadorAlumnos: (params: BuscadorPagosParams) =>
    [...pagosKeys.all, 'buscador-alumnos', params] as const,
  buscadorProfesores: (params: BuscadorAcotadoParams) =>
    [...pagosKeys.all, 'buscador-profesores', params] as const,
  buscadorMaterias: (params: BuscadorAcotadoParams) =>
    [...pagosKeys.all, 'buscador-materias', params] as const,
}
