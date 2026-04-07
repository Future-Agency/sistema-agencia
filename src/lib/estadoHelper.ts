import { supabase } from './supabase'

/**
 * Actualiza el estado de un cliente y registra el cambio en estado_log.
 * Usar esta función en TODOS los lugares donde se cambia el estado de un cliente.
 */
export async function updateEstado(
  clienteId: number,
  newEstado: string,
  oldEstado: string | null,
  changedBy: string = 'sistema'
) {
  if (oldEstado === newEstado) return

  await Promise.all([
    supabase.from('clientes').update({
      estado: newEstado,
      estado_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', clienteId),
    supabase.from('estado_log').insert({
      cliente_id: clienteId,
      estado_anterior: oldEstado,
      estado_nuevo: newEstado,
      changed_by: changedBy,
    }),
  ])
}
