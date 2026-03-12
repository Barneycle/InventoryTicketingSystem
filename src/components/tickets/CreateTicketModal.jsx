import { useState } from 'react'
import Modal from '../ui/Modal'
import TicketForm from './TicketForm'
import { useCreateTicket } from '../../hooks/useTickets'

export default function CreateTicketModal({ open, onClose, onCreated }) {
  const [error, setError] = useState('')
  const createTicket = useCreateTicket()

  async function handleSubmit(payload) {
    setError('')
    try {
      const { id } = await createTicket.mutateAsync(payload)
      onClose()
      if (onCreated && id) onCreated(id)
    } catch (err) {
      setError(err?.message ?? 'Failed to create ticket.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New ticket" size="md">
      <TicketForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={onClose}
        loading={createTicket.isPending}
        error={error}
      />
    </Modal>
  )
}
