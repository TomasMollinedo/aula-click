import { hrefAltaConVuelta } from '@/features/alumnos/volver-a'
import { RegistrarTurnoPantalla } from '@/features/turnos/components/RegistrarTurnoPantalla'

export default function TurnosPage() {
  return (
    <RegistrarTurnoPantalla
      rutaBase="/mesa/turnos"
      hrefAltaAlumno={hrefAltaConVuelta('/mesa/alumnos', 'turnos')}
    />
  )
}
