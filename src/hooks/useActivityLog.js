import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useActivityLog(limit = null) {
  return useQuery({
    queryKey: ['activity_log', limit ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
      if (limit != null) q = q.limit(limit)
      const { data, error } = await q
      if (error) {
        console.error('[useActivityLog] error:', error)
        throw error
      }
      return data ?? []
    },
  })
}

export function useItemHistory(itemId) {
  return useQuery({
    queryKey: ['item_history', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: !!itemId,
  })
}
