import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .order('full_name', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
  })
}
