import { useState, useMemo } from 'react'
import Button from '../ui/Button'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../hooks/useTickets'
import { useAuth } from '../../contexts/AuthContext'
import { useItems } from '../../hooks/useItems'

const baseInput = 'block w-full rounded-lg border border-gray-400 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function deviceLabel(item) {
  if (!item) return ''
  const name = [item.brand, item.model].filter(Boolean).join(' ') || 'Unknown'
  return item.serial_number ? `${name} (${item.serial_number})` : name
}

export default function TicketForm({
  mode = 'create',
  ticket,
  profiles = [],
  onSubmit,
  onCancel,
  loading = false,
  error = '',
  canEditStatusAssignee = false,
}) {
  const { user } = useAuth()
  const { data: allItems = [] } = useItems()
  const { data: profilesList = [] } = useProfiles()
  const myDevices = useMemo(
    () => allItems.filter((i) => i.assigned_to && i.assigned_to === user?.id),
    [allItems, user?.id]
  )

  const [title, setTitle] = useState(ticket?.title ?? '')
  const [description, setDescription] = useState(ticket?.description ?? '')
  const [priority, setPriority] = useState(ticket?.priority ?? 'Medium')
  const [status, setStatus] = useState(ticket?.status ?? 'Open')
  const [assigneeId, setAssigneeId] = useState(ticket?.assigned_to ?? '')
  const [isAboutDevice, setIsAboutDevice] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const isCreate = mode === 'create'

  function handleSubmit(e) {
    e.preventDefault()
    if (isCreate) {
      const item_id = isAboutDevice && selectedDeviceId ? selectedDeviceId : null
      onSubmit({ item_id, title: title.trim(), description: description.trim() || null, priority })
    } else {
      onSubmit({
        id: ticket.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        assigned_to: assigneeId || null,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={baseInput}
          placeholder="Brief summary of the issue"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${baseInput} min-h-[80px] resize-y`}
          placeholder="More details (optional)"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={baseInput}
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {isCreate && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAboutDevice}
              onChange={(e) => {
                setIsAboutDevice(e.target.checked)
                if (!e.target.checked) setSelectedDeviceId('')
              }}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">This is about a device</span>
          </label>
          {isAboutDevice && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Which device?
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className={baseInput}
              >
                <option value="">Select your device</option>
                {myDevices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {deviceLabel(i)}
                  </option>
                ))}
              </select>
              {myDevices.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  No devices assigned to you. Create the ticket without a device or ask an admin to assign you one.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!isCreate && canEditStatusAssignee && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={baseInput}>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assigned to</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={baseInput}
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.id?.slice(0, 8) || p.id}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isCreate ? 'Create ticket' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
