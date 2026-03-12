import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const BUCKET = 'ticket-attachments'

export function useTicketAttachments(ticketId) {
  return useQuery({
    queryKey: ['ticket_attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!ticketId,
  })
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

export function useUploadTicketAttachment(ticketId) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (file) => {
      const safeName = sanitizeFileName(file.name)
      const { data: row, error: insertError } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          file_name: file.name,
          storage_path: `${ticketId}/pending/${safeName}`,
          uploaded_by: user?.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const storagePath = `${ticketId}/${row.id}/${safeName}`

      const { error: updateError } = await supabase
        .from('ticket_attachments')
        .update({ storage_path: storagePath })
        .eq('id', row.id)
      if (updateError) throw updateError

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: true })
      if (uploadError) throw uploadError

      return { id: row.id, file_name: file.name, storage_path: storagePath }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_attachments', ticketId] })
    },
  })
}

export function useDeleteTicketAttachment(ticketId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (attachment) => {
      if (attachment.storage_path) {
        await supabase.storage.from(BUCKET).remove([attachment.storage_path])
      }
      const { error } = await supabase.from('ticket_attachments').delete().eq('id', attachment.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_attachments', ticketId] })
    },
  })
}

export function getAttachmentDownloadUrl(attachment) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(attachment.storage_path)
  return data?.publicUrl
}

export function getAttachmentSignedUrl(storagePath, expiresIn = 3600) {
  return supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
}
