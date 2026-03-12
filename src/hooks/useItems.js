import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function itemLabel(item) {
  return [item.brand, item.model].filter(Boolean).join(' ') || 'Unknown'
}

function logActivity(userId, action, item) {
  const name = item?.name ?? itemLabel(item)
  supabase.from('activity_log').insert({
    user_id: userId,
    action,
    item_id: item?.id ?? null,
    item_name: name,
    details: { status: item?.status, serial_number: item?.serial_number },
  }).then(({ error }) => { if (error) console.warn('[logActivity] failed:', error.message) })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (itemData) => {
      const { error } = await supabase
        .from('items')
        .insert(itemData)
      if (error) throw error
      logActivity(user?.id, 'created', { name: itemData.model ?? itemData.serial_number })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { error } = await supabase
        .from('items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      logActivity(user?.id, 'updated', { id, name: updates.model ?? updates.serial_number ?? id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    },
  })
}

export function useBulkUpdateItems() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ ids, updates }) => {
      const payload = { ...updates, updated_at: new Date().toISOString() }
      const BATCH = 50
      for (let i = 0; i < ids.length; i += BATCH) {
        if (i > 0) await new Promise(r => setTimeout(r, 150))
        const chunk = ids.slice(i, i + BATCH)
        const { error } = await supabase.from('items').update(payload).in('id', chunk)
        if (error) throw error
      }
      supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'bulk_update',
        item_name: `Bulk update (${ids.length} item${ids.length !== 1 ? 's' : ''})`,
        details: updates,
      }).then(({ error: e }) => { if (e) console.warn('[bulk_update] log failed:', e.message) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    },
  })
}

export function useBulkDeleteItems() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (ids) => {
      const BATCH = 50
      for (let i = 0; i < ids.length; i += BATCH) {
        if (i > 0) await new Promise(r => setTimeout(r, 150))
        const chunk = ids.slice(i, i + BATCH)
        const { error } = await supabase.from('items').delete().in('id', chunk)
        if (error) throw error
      }
      supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'bulk_delete',
        item_name: `Bulk delete (${ids.length} item${ids.length !== 1 ? 's' : ''})`,
        details: { count: ids.length },
      }).then(({ error: e }) => { if (e) console.warn('[bulk_delete] log failed:', e.message) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (item) => {
      const { error } = await supabase.from('items').delete().eq('id', item.id)
      if (error) throw error
      logActivity(user?.id, 'deleted', item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    },
  })
}
