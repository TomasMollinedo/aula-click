// Textos de turnos que comparten varias features (la barra de `cuentas`, el cobro y los pagos del
// portal). Vive en utils/ para que cualquier feature lo use sin importar de otra.

/** La cantidad de turnos en una frase: `'1 turno'` / `'8 turnos'`. */
export function textoCantidadDeTurnos(cantidad: number): string {
  return cantidad === 1 ? '1 turno' : `${cantidad} turnos`
}
