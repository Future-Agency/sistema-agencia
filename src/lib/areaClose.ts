// Configuración del cierre de cada área:
//   - qué link se pide al pasar al estado final
//   - qué comentario opcional se guarda
//   - qué fecha se registra automáticamente
//   - qué pre-flight requirements existen antes de poder cerrar
//
// Una pieza está en su área final si su estado_<area> es el último (índice = approvedStateId).

import type { UserArea } from './users'
import type { ClienteCicloRecursos } from './supabase'
import { AREA_DEFS } from './areaStates'

type RecursosField = keyof ClienteCicloRecursos

export type PreflightLink = {
  field: RecursosField
  label: string
  placeholder: string
  icon: string
  /** Tipo del input. Default 'url'. */
  type?: 'url' | 'number' | 'date'
  /** Helper opcional bajo el input */
  helper?: string
}

export type AreaCloseConfig = {
  /** Estado label que dispara el modal (typically area.approvedStateId) */
  closeState: string
  /** Field principal donde se guarda el link de cierre */
  linkField: RecursosField
  linkLabel: string
  linkPlaceholder: string
  linkHelper: string
  /** Field de comentario opcional */
  commentField: RecursosField
  commentPlaceholder: string
  /** Field timestamp donde se registra la fecha de cierre */
  dateField: RecursosField
  /** Pre-flight: estos links DEBEN estar cargados antes del cierre */
  preflight: PreflightLink[]
  /** Texto explicativo del cierre */
  description: string
  /** Color principal del modal */
  color: string
  /** Emoji del área */
  emoji: string
}

export const AREA_CLOSE_CONFIG: Record<UserArea, AreaCloseConfig> = {
  copys: {
    closeState: AREA_DEFS.copys.states[AREA_DEFS.copys.approvedStateId].label,    // LISTO PARA GRABAR
    linkField: 'drive_scripts_url',
    linkLabel: 'Drive con los scripts finales',
    linkPlaceholder: 'https://docs.google.com/...',
    linkHelper: 'Link al doc/carpeta con los guiones aprobados por el cliente.',
    commentField: 'comentario_scripts',
    commentPlaceholder: 'observaciones para producción (ángulos, tono, tiempos…)',
    dateField: 'fecha_scripts_listos',
    // El pre-flight de copys se aplica en otra transición (MÉTRICAS → POR HACER SCRIPTS),
    // ver areaPreflightGates.ts. Aquí solo pedimos el drive de scripts.
    preflight: [],
    description: 'Scripts finales aprobados por el cliente. Listo para coordinar la grabación.',
    color: '#a78bfa',
    emoji: '✍️',
  },
  grab: {
    closeState: AREA_DEFS.grab.states[AREA_DEFS.grab.approvedStateId].label,      // MATERIAL SUBIDO
    linkField: 'drive_videos_crudos_url',
    linkLabel: 'Drive del material crudo',
    linkPlaceholder: 'https://drive.google.com/...',
    linkHelper: 'Link a la carpeta Drive donde se subió todo el material grabado.',
    commentField: 'notas_material',
    commentPlaceholder: 'ej: faltó cubrir el ángulo del producto X; la luz del video 4 quedó floja; B-roll para reel 7…',
    dateField: 'fecha_material_subido',
    preflight: [],
    description: 'Material grabado y subido al Drive. Sin link no se cierra la etapa.',
    color: '#5e72e4',
    emoji: '🎥',
  },
  edit: {
    closeState: AREA_DEFS.edit.states[AREA_DEFS.edit.approvedStateId].label,      // APROBADO
    linkField: 'drive_videos_editados_url',
    linkLabel: 'Drive con los videos editados',
    linkPlaceholder: 'https://drive.google.com/...',
    linkHelper: 'Link a la carpeta con los videos finales aprobados por el cliente.',
    commentField: 'comentario_edicion',
    commentPlaceholder: 'observaciones para diseño / community manager (ritmo, transiciones, cortes…)',
    dateField: 'fecha_videos_editados',
    preflight: [],
    description: 'Videos editados y aprobados por el cliente. Listo para que diseño cierre portadas.',
    color: '#fb6340',
    emoji: '✂️',
  },
  diseno: {
    closeState: AREA_DEFS.diseno.states[AREA_DEFS.diseno.approvedStateId].label,  // APROBADO
    linkField: 'drive_portadas_url',
    linkLabel: 'Drive con portadas / carrouseles / historias',
    linkPlaceholder: 'https://drive.google.com/...',
    linkHelper: 'Link a la carpeta con los diseños finales (portadas + carrouseles + historias) aprobados.',
    commentField: 'comentario_diseno',
    commentPlaceholder: 'observaciones para community / programación (formato preferido, ángulos clave…)',
    dateField: 'fecha_diseno_aprobado',
    preflight: [],
    description: 'Portadas y artes aprobados por el cliente. Listo para programar.',
    color: '#ec4ad8',
    emoji: '🎨',
  },
  subida: {
    closeState: AREA_DEFS.subida.states[AREA_DEFS.subida.approvedStateId].label,  // PUBLICADO
    linkField: 'metricool_url',
    linkLabel: 'Link a Metricool / programación',
    linkPlaceholder: 'https://app.metricool.com/...',
    linkHelper: 'Link al calendario Metricool con todo el contenido programado/publicado del ciclo.',
    commentField: 'comentario_subida',
    commentPlaceholder: 'observaciones de la publicación (qué quedó pendiente, ajustes finos…)',
    dateField: 'fecha_publicacion',
    preflight: [
      {
        field: 'cantidad_contenidos_subidos',
        label: 'Cantidad de contenidos subidos',
        placeholder: 'ej: 30',
        icon: '🔢',
        type: 'number',
        helper: 'Cuántos contenidos efectivamente quedaron programados/publicados. Validá contra lo pactado.',
      },
      {
        field: 'fecha_ultimo_contenido_subido',
        label: 'Última fecha de contenido del ciclo',
        placeholder: 'AAAA-MM-DD',
        icon: '📅',
        type: 'date',
        helper: 'Fecha del último post programado — para saber hasta cuándo hay contenido planificado.',
      },
    ],
    description: 'Todo el contenido del ciclo publicado. El loop pasa a Reportes para activar ads y armar el reporte final.',
    color: '#00d97e',
    emoji: '🚀',
  },
  anuncios: {
    closeState: AREA_DEFS.anuncios.states[AREA_DEFS.anuncios.approvedStateId].label,  // VOLVER A EMPEZAR
    linkField: 'reporte_url',
    linkLabel: 'Link al reporte del ciclo (ads + orgánico)',
    linkPlaceholder: 'https://docs.google.com/...',
    linkHelper: 'Reporte final del ciclo con métricas, insights y recomendaciones (ads + orgánico).',
    commentField: 'comentario_subida',
    commentPlaceholder: 'cierre del ciclo: qué funcionó, qué no, qué replicar el mes que viene…',
    dateField: 'fecha_reporte_listo',
    preflight: [],
    description: 'Reporte armado y entregado al cliente. El loop vuelve a empezar el próximo mes.',
    color: '#f5a623',
    emoji: '📊',
  },
}

/** Lista de campos pre-flight no completados para un área dada */
export function missingPreflight(area: UserArea, recursos: ClienteCicloRecursos | null): PreflightLink[] {
  const cfg = AREA_CLOSE_CONFIG[area]
  if (cfg.preflight.length === 0) return []
  if (!recursos) return cfg.preflight
  return cfg.preflight.filter(p => {
    const v = recursos[p.field] as string | null | undefined
    return !v || !v.trim()
  })
}
