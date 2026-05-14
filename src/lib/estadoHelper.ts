import { supabase } from './supabase'
import { currentCicloMes } from './cycles'

/**
 * Actualiza el estado de un cliente y mantiene TODO sincronizado:
 *   1. cliente.estado (legacy, lo que ven Edición tracker, etc.)
 *   2. estado_log (audit trail)
 *   3. cliente_ciclo_recursos.estado_loop del CICLO PRIMARIO
 *      → primary = cliente.ciclo_mes si está seteado, sino el mes calendario actual
 *
 * Usar esta función en TODOS los lugares donde se cambia el estado de un cliente.
 *
 * Sentido de la sync:
 *   - Vista vieja escribe cliente.estado → mirror al estado_loop del ciclo primario
 *   - Vista nueva escribe estado_loop → setEstadoLoop hace el mirror inverso
 *   - Resultado: sin importar dónde edites, las dos vistas se quedan en el mismo valor
 */
export async function updateEstado(
  clienteId: number,
  newEstado: string,
  oldEstado: string | null,
  changedBy: string = 'sistema'
) {
  if (oldEstado === newEstado) return

  // 1. Resolver ciclo primario (para taggear estado_log y mirror)
  const { data: cliente } = await supabase
    .from('clientes').select('agencia_id, ciclo_mes').eq('id', clienteId).single()
  const primaryCycle = cliente?.ciclo_mes || currentCicloMes()

  // 2+3. Update cliente.estado + estado_log (con ciclo_mes)
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
      ciclo_mes: primaryCycle,
    }),
  ])

  // 4. Mirror al estado_loop del ciclo primario
  try {
    if (cliente?.agencia_id) {
      await supabase.from('cliente_ciclo_recursos').upsert({
        agencia_id: cliente.agencia_id,
        cliente_id: clienteId,
        ciclo_mes: primaryCycle,
        estado_loop: newEstado || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cliente_id,ciclo_mes' })
    }
  } catch (e) {
    console.warn('[updateEstado] mirror a estado_loop falló:', e)
  }
}
