// Lo que otras features necesitan del cobro sin importar `pagos.reglas.ts` (de otra feature solo
// se importan `*.repository` y `*.condiciones`, lo hace cumplir ESLint). Lo consume `cuentas`
// (T-53): los "próximos" de la cuenta usan el mismo tope de 8 semanas que `POST /pagos`, así la UI
// nunca ofrece cobrar algo que la API rechaza con `FUERA_DE_RANGO`, y la deuda se suma en
// centavos como el total de un pago. Sólo re-exporta: la implementación es la de `pagos.reglas.ts`.

export { DIAS_MAXIMOS_COBRO, limiteDeCobro, sumarImportes } from './pagos.reglas'
