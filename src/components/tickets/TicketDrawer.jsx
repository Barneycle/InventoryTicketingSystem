import { useEffect, useState, useRef } from 'react'
import { X, Package, MessageSquare, Paperclip, Pencil, Download, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTicket, useUpdateTicket, TICKET_STATUSES, TICKET_PRIORITIES } from '../../hooks/useTickets'
import { useTicketComments, useAddComment, useDeleteComment } from '../../hooks/useTicketComments'
import {
  useTicketAttachments,
  useUploadTicketAttachment,
  useDeleteTicketAttachment,
  getAttachmentSignedUrl,
} from '../../hooks/useTicketAttachments'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import TicketForm from './TicketForm'

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function deviceLabel(item) {
  if (!item) return '—'
  const name = [item.brand, item.model].filter(Boolean).join(' ') || 'Unknown'
  return item.serial_number ? `${name} (${item.serial_number})` : name
}

export default function TicketDrawer({ ticketId, onClose }) {
  const open = !!ticketId
  const { role } = useAuth()
  const { data: ticket, isLoading } = useTicket(ticketId)
  const { data: profiles = [] } = useProfiles()
  const [editModalOpen, setEditModalOpen] = useState(false)

  const canEdit = !!ticket && role === 'admin'
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!ticketId) return null

  function assigneeDisplay() {
    if (!ticket?.assigned_to) return 'Unassigned'
    const p = profileMap[ticket.assigned_to]
    return p?.full_name || ticket.assigned_to?.slice(0, 8) || '—'
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-zinc-50 dark:bg-gray-900 shadow-2xl border-l border-gray-300 dark:border-gray-800 flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 truncate">
                {ticket?.title ?? 'Ticket'}
              </h2>
            )}
            {ticket && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Updated {formatDate(ticket.updated_at)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ) : !ticket ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ticket not found.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ticket.status}>{ticket.status}</Badge>
                <Badge variant={ticket.priority}>{ticket.priority}</Badge>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditModalOpen(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                )}
              </div>

              {ticket.description && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Description</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Device
                </h3>
                {ticket.items ? (
                  <Link
                    to={`/inventory?item=${ticket.item_id}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {deviceLabel(ticket.items)}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">No device linked</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 block">Assigned to</span>
                  <span className="text-gray-900 dark:text-gray-100">{assigneeDisplay()}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 block">Created</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatDate(ticket.created_at)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments
                </h3>
                <CommentList ticketId={ticket.id} canEdit={canEdit} profileMap={profileMap} />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  Attachments
                </h3>
                <AttachmentList ticketId={ticket.id} canEdit={canEdit} />
              </div>
            </>
          )}
        </div>
      </div>

      {ticket && (
        <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit ticket" size="md">
          <EditTicketForm
            ticket={ticket}
            profiles={profiles}
            onSuccess={() => setEditModalOpen(false)}
            onCancel={() => setEditModalOpen(false)}
          />
        </Modal>
      )}
    </>
  )
}

function EditTicketForm({ ticket, profiles, onSuccess, onCancel }) {
  const [error, setError] = useState('')
  const updateTicket = useUpdateTicket()

  async function handleSubmit(payload) {
    setError('')
    try {
      await updateTicket.mutateAsync(payload)
      onSuccess()
    } catch (err) {
      setError(err?.message ?? 'Failed to update ticket.')
    }
  }

  return (
    <TicketForm
      mode="edit"
      ticket={ticket}
      profiles={profiles}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      loading={updateTicket.isPending}
      error={error}
      canEditStatusAssignee={true}
    />
  )
}

function CommentList({ ticketId, canEdit, profileMap }) {
  const [body, setBody] = useState('')
  const { data: comments = [], isLoading } = useTicketComments(ticketId)
  const addComment = useAddComment(ticketId)
  const deleteComment = useDeleteComment(ticketId)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    try {
      await addComment.mutateAsync(trimmed)
      setBody('')
    } catch (_) {}
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading comments…</div>
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <div className="flex-1 min-w-0 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {profileMap[c.author_id]?.full_name ?? c.author_id?.slice(0, 8) ?? 'User'}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(c.created_at)}</span>
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{c.body}</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteComment.mutate(c.id)}
                  className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[72px] resize-y"
            rows={2}
          />
          <Button type="submit" size="sm" disabled={!body.trim() || addComment.isPending}>
            {addComment.isPending ? 'Sending…' : 'Post comment'}
          </Button>
        </form>
      )}
    </div>
  )
}

function AttachmentList({ ticketId, canEdit }) {
  const fileInputRef = useRef(null)
  const { user } = useAuth()
  const { data: attachments = [], isLoading } = useTicketAttachments(ticketId)
  const uploadAttachment = useUploadTicketAttachment(ticketId)
  const deleteAttachment = useDeleteTicketAttachment(ticketId)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAttachment.mutateAsync(file)
      e.target.value = ''
    } catch (_) {}
  }

  async function handleDownload(att) {
    try {
      const { data, error } = await getAttachmentSignedUrl(att.storage_path, 60)
      if (error) throw error
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (_) {}
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading attachments…</div>
  }

  return (
    <div className="space-y-2">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploadAttachment.isPending}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending ? 'Uploading…' : 'Upload file'}
        </Button>
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No attachments yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
            >
              <span className="truncate text-gray-700 dark:text-gray-300" title={att.file_name}>
                {att.file_name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {(canEdit || att.uploaded_by === user?.id) && (
                  <button
                    type="button"
                    onClick={() => deleteAttachment.mutate(att)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
