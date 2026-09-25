import { BarChart3, CalendarDays, MousePointer2, Users } from 'lucide-react'
import Image from 'next/image'

const caracteristicas = [
  {
    icono: Users,
    titulo: 'Gestión de alumnos',
    descripcion: 'Todo en un solo lugar',
  },
  {
    icono: CalendarDays,
    titulo: 'Organización académica',
    descripcion: 'Turnos, materias y más',
  },
  {
    icono: BarChart3,
    titulo: 'Mejor atención',
    descripcion: 'Una comunidad más conectada',
  },
]

/**
 * Blur progresivo (técnica de Linear/Vision Pro): varias capas `backdrop-blur` idénticas, cada una
 * más intensa, enmascaradas con un degradado que arranca más a la derecha en cada capa. Como el
 * `backdrop-filter` de una capa ve el resultado ya desenfocado de la anterior, se van sumando: la
 * foto se ve nítida a la izquierda y cada vez más borrosa según se acerca a la tarjeta del login,
 * en vez de pasar de golpe de nítida a borrosa en el borde de la tarjeta.
 */
// Porcentajes relativos al ancho de esta sección (62%, no de la pantalla completa).
const CAPAS_BLUR = [
  { blur: 'backdrop-blur-[3px]', desde: '45%', hasta: '60%' },
  { blur: 'backdrop-blur-[8px]', desde: '55%', hasta: '70%' },
  { blur: 'backdrop-blur-[16px]', desde: '65%', hasta: '80%' },
  { blur: 'backdrop-blur-[28px]', desde: '75%', hasta: '90%' },
  { blur: 'backdrop-blur-[40px]', desde: '85%', hasta: '100%' },
]

// Columna del 62% (no toda la pantalla): la foto se ve nítida a la izquierda, se va desenfocando
// (CAPAS_BLUR) y funde a blanco (--canvas, el fondo de LoginPanel) en su ~20% final, así el borde
// con el panel es un difuminado, no un corte recto ni una foto completa detrás del formulario.
export function LoginHero() {
  return (
    <section className="relative hidden w-[62%] overflow-hidden lg:block">
      <Image
        src="/login-hero.webp"
        alt=""
        fill
        priority
        sizes="62vw"
        className="object-cover object-bottom"
      />

      {CAPAS_BLUR.map(({ blur, desde, hasta }) => (
        <div
          key={blur}
          aria-hidden
          className={`absolute inset-0 ${blur}`}
          style={{
            maskImage: `linear-gradient(to right, transparent ${desde}, black ${hasta})`,
            WebkitMaskImage: `linear-gradient(to right, transparent ${desde}, black ${hasta})`,
          }}
        />
      ))}

      {/* Velo diagonal: oscurece la izquierda para que el texto se lea sobre la foto y se apaga
          hacia la derecha. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,rgba(32,36,31,0.75)_0%,rgba(32,36,31,0.55)_28%,rgba(32,36,31,0.2)_50%,transparent_66%)]"
      />

      {/* Fundido final a blanco: mismo color que LoginPanel (--canvas), para que el 20% final de
          la foto ya desenfocada se disuelva en el panel en vez de terminar en un borde recto. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,transparent_68%,rgba(244,245,249,0.45)_82%,rgba(244,245,249,0.85)_92%,#f4f5f9_100%)]"
      />

      {/* Contenido, sobre la foto: los textos pasan a claros (antes eran oscuros, para el fondo
          plano #eef1fc que tenía esta sección). */}
      <div className="relative z-10 flex max-w-xl flex-col px-12 pt-10">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="bg-dorado flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <MousePointer2 className="size-5 fill-white text-white" />
          </span>

          <div>
            <p className="text-lg leading-tight font-semibold text-white">
              Aula<span className="text-dorado">Click</span>
            </p>

            <p className="text-xs text-white/70">Centro de Atención Académica</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="max-w-sm text-4xl leading-[1.08] font-bold tracking-tight text-balance text-white">
            Acompañamos tu camino académico
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
            Un centro de atención diseñado para facilitar la gestión, el seguimiento y el bienestar
            de nuestra comunidad educativa.
          </p>
        </div>

        <ul className="mt-8 space-y-4">
          {caracteristicas.map(({ icono: Icono, titulo, descripcion }) => (
            <li key={titulo} className="flex items-center gap-3">
              <span className="bg-dorado/20 text-dorado ring-dorado/20 flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-md ring-1 backdrop-blur-sm">
                <Icono className="size-6" />
              </span>

              <div>
                <p className="text-sm font-semibold text-white">{titulo}</p>
                <p className="text-xs text-white/70">{descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
