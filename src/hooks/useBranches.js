import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
