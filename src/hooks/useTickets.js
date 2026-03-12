import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TICKET_STATUSES = ['Open', 'In progress', 'Waiting on user', 'Resolved', 'Closed']
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export { TICKET_STATUSES, TICKET_PRIORITIES }

export function useTickets(filters = {}) {
  const { status, priority, assigned_to, item_id } = filters
  return useQuery({
    queryKey: ['tickets', { status, priority, assigned_to, item_id }],
    queryFn: async () => {
      let q = supabase
        .from('tickets')
        .select('*, items(id, brand, model, serial_number)')
        .order('updated_at', { ascending: false })
      if (status) q = q.eq('status', status)
      if (priority) q = q.eq('priority', priority)
      if (assigned_to) q = q.eq('assigned_to', assigned_to)
      if (item_id) q = q.eq('item_id', item_id)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, items(id, brand, model, serial_number)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload) => {
      const row = {
        ...payload,
        created_by: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('tickets').insert(row).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { error } = await supabase
        .from('tickets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return { id, ...updates }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
    },
  })
}
