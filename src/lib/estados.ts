// Workflow ONGOING — 19 pasos canónicos
// Los estados de ONBOARDING se definirán por separado

export const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  'GUIONES': { bg: 'rgba(0,217,126,.12)', color: '#00d97e' },
  'REVISION GUIONES': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'CORRECION GUIONES': { bg: 'rgba(245,166,35,.15)', color: '#f5a623' },
  'PRODUCCIÓN A CONFIRMAR': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'PRODUCCION CONFIRMADA': { bg: 'rgba(0,217,126,.15)', color: '#00d97e' },
  'EDICIÓN': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'DISEÑO': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'REVISION - RAMI': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'REVISION CLIENTE': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'CORRECION': { bg: 'rgba(245,54,92,.15)', color: '#f5365c' },
  'APROBADO - SUBIDA A CLICKUP': { bg: 'rgba(106,106,128,.12)', color: '#a0a0b8' },
  'PROGRAMACION': { bg: 'rgba(0,217,126,.15)', color: '#00d97e' },
  'PROGAMADO': { bg: 'rgba(0,217,126,.2)', color: '#00d97e' },
  'ANUNCIOS SIN ACTIVAR': { bg: 'rgba(245,54,92,.15)', color: '#f5365c' },
  'ANUNCIOS PRENDIDOS': { bg: 'rgba(0,160,90,.2)', color: '#00d97e' },
  'ANUNCIOS CHECK': { bg: 'rgba(245,214,35,.15)', color: '#f5d623' },
  'METRICAS Y VOLVER A EMPEZAR': { bg: 'rgba(245,214,35,.18)', color: '#f5d623' },
  'Onboarding': { bg: 'rgba(245,166,35,.12)', color: '#fbbf24' },
}

export const ESTADO_OPTIONS_ONGOING = [
  'GUIONES', 'REVISION GUIONES', 'CORRECION GUIONES',
  'PRODUCCIÓN A CONFIRMAR', 'PRODUCCION CONFIRMADA',
  'EDICIÓN',
  'REVISION - RAMI', 'CORRECION', 'DISEÑO',
  'REVISION CLIENTE',
  'APROBADO - SUBIDA A CLICKUP', 'PROGRAMACION', 'PROGAMADO',
  'ANUNCIOS SIN ACTIVAR', 'ANUNCIOS PRENDIDOS', 'ANUNCIOS CHECK',
  'METRICAS Y VOLVER A EMPEZAR',
]

// Estados que indican campañas de anuncios activas
export const ESTADOS_ADS_ACTIVOS = ['ANUNCIOS PRENDIDOS', 'ANUNCIOS CHECK']
// Estados que indican anuncios pendientes de activar
export const ESTADOS_ADS_PENDIENTES = ['ANUNCIOS SIN ACTIVAR', 'PROGAMADO']

export function getEstadoStyle(estado: string): { bg: string; color: string } {
  return ESTADO_COLORS[estado] || { bg: 'rgba(94,114,228,0.1)', color: '#8b9cf7' }
}
