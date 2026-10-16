import { View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { fechaDocumento, formatearPesos } from '@/server/shared/formato'
import { CampoPdf, CamposPdf, MensajePdf, SeccionPdf } from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import { SEPARACION_BLOQUES } from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import {
  NOMBRE_FORMA_DE_PAGO,
  textoHoraDeRegistro,
  textoImporteConSigno,
  textoMovimiento,
  textoSinMovimientos,
} from './caja.formato'
import type { Caja } from './caja.validation'

// La caja diaria en PDF (HU-46, T-127). Solo presentación: recibe la `Caja` que devuelve el service y
// no suma ni recalcula nada (ingresos, partes, egresos y saldo son los de la API). Primero el
// resumen del día y después la lista completa de movimientos, por hora de registro. Los textos
// salen de `caja.formato.ts`.

export type DatosCajaPdf = EncabezadoDeDocumento & { caja: Caja }

const TITULO = 'Caja diaria'

// Proporciones de las columnas (no puntos). Los importes van a la derecha, con su signo.
const COLUMNAS: readonly ColumnaPdf[] = [
  { titulo: 'Hora', ancho: 13 },
  { titulo: 'Movimiento', ancho: 47 },
  { titulo: 'Forma de pago', ancho: 20 },
  { titulo: 'Importe', ancho: 20, numerica: true },
]

export function CajaPdf({ caja, ...encabezado }: DatosCajaPdf) {
  const { fecha, resumen, movimientos } = caja
  const { ingresos } = resumen

  return (
    <DocumentoOficialPdf titulo={TITULO} referencia={fechaDocumento(fecha)} {...encabezado}>
      <View style={{ gap: SEPARACION_BLOQUES }}>
        <SeccionPdf>
          <CamposPdf>
            <CampoPdf
              label={NOMBRE_FORMA_DE_PAGO.EFECTIVO}
              valor={formatearPesos(ingresos.porForma.EFECTIVO)}
            />
            <CampoPdf
              label={NOMBRE_FORMA_DE_PAGO.TRANSFERENCIA}
              valor={formatearPesos(ingresos.porForma.TRANSFERENCIA)}
            />
            <CampoPdf
              label={NOMBRE_FORMA_DE_PAGO.DEBITO}
              valor={formatearPesos(ingresos.porForma.DEBITO)}
            />
            <CampoPdf label="Total de ingresos" valor={formatearPesos(ingresos.total)} />
            <CampoPdf label="Parte del centro" valor={formatearPesos(ingresos.parteCentro)} />
            <CampoPdf
              label="Parte de los profesores"
              valor={formatearPesos(ingresos.parteProfesores)}
            />
            <CampoPdf
              label="Egresos (pagado a profesores)"
              valor={formatearPesos(resumen.egresos)}
            />
            <CampoPdf label="Saldo del día" valor={formatearPesos(resumen.saldo)} />
          </CamposPdf>
        </SeccionPdf>

        {movimientos.length === 0 ? (
          <MensajePdf>{textoSinMovimientos(fecha)}</MensajePdf>
        ) : (
          <TablaPdf columnas={COLUMNAS} alternada>
            {movimientos.map((movimiento, i) => (
              <FilaPdf key={i}>
                <CeldaPdf>{textoHoraDeRegistro(movimiento.registradoEl, fecha)}</CeldaPdf>
                <CeldaPdf>{textoMovimiento(movimiento)}</CeldaPdf>
                <CeldaPdf>{movimiento.formaPago.nombre}</CeldaPdf>
                <CeldaPdf>{textoImporteConSigno(movimiento)}</CeldaPdf>
              </FilaPdf>
            ))}
          </TablaPdf>
        )}
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF de la caja de un día, con la lista completa de movimientos. */
export function renderizarCajaPdf(datos: DatosCajaPdf): Promise<Buffer> {
  return renderizarPdf(<CajaPdf {...datos} />)
}
