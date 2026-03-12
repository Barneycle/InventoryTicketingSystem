import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useTicketComments(ticketId) {
  return useQuery({
    queryKey: ['ticket_comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!ticketId,
  })
}

export function useAddComment(ticketId) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (body) => {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: user?.id,
        body: body.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_comments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })
}

export function useDeleteComment(ticketId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase.from('ticket_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_comments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })
}
