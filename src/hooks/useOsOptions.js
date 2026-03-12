import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Display order for OS dropdown (not alphabetical)
const OS_DISPLAY_ORDER = [
  'Windows 7',
  'Windows 8',
  'Windows 8.1',
  'Windows 10',
  'Windows 10 Home',
  'Windows 10 Pro',
  'Windows 10 Enterprise',
  'Windows 10 Education',
  'Windows 11',
  'Windows 11 Home',
  'Windows 11 Pro',
  'Windows 11 Enterprise',
  'Windows 11 Education',
  'macOS',
  'Ubuntu',
  'Linux (Other)',
  'Chrome OS',
  'Other',
]

function sortByDisplayOrder(items) {
  const order = new Map(OS_DISPLAY_ORDER.map((name, i) => [name, i]))
  return [...(items ?? [])].sort((a, b) => {
    const nameA = a.name ?? ''
    const nameB = b.name ?? ''
    const iA = order.has(nameA) ? order.get(nameA) : OS_DISPLAY_ORDER.length
    const iB = order.has(nameB) ? order.get(nameB) : OS_DISPLAY_ORDER.length
    return iA !== iB ? iA - iB : nameA.localeCompare(nameB)
  })
}

export function useOsOptions() {
  return useQuery({
    queryKey: ['os_options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_options')
        .select('id, name')
      if (error) throw error
      return sortByDisplayOrder(data ?? [])
    },
  })
}
