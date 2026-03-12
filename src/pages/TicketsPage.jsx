import { useState, useMemo } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTickets, TICKET_STATUSES, TICKET_PRIORITIES } from '../hooks/useTickets'
import { useAuth } from '../contexts/AuthContext'
import { useProfiles } from '../hooks/useProfiles'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import CreateTicketModal from '../components/tickets/CreateTicketModal'
import TicketDrawer from '../components/tickets/TicketDrawer'

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function deviceLabel(item) {
  if (!item) return '—'
  const name = [item.brand, item.model].filter(Boolean).join(' ') || 'Unknown'
  return item.serial_number ? `${name} (${item.serial_number})` : name
}

export default function TicketsPage() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)

  const filters = useMemo(() => {
    const f = {}
    if (statusFilter) f.status = statusFilter
    if (priorityFilter) f.priority = priorityFilter
    if (assignedToMe && user?.id) f.assigned_to = user.id
    return f
  }, [statusFilter, priorityFilter, assignedToMe, user?.id])

  const { data: tickets = [], isLoading } = useTickets(filters)
  const { data: profiles = [] } = useProfiles()

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles])

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets
    const q = search.toLowerCase()
    return tickets.filter((t) => {
      const title = (t.title ?? '').toLowerCase()
      const device = deviceLabel(t.items).toLowerCase()
      return title.includes(q) || device.includes(q)
    })
  }, [tickets, search])

  function assigneeDisplay(ticket) {
    if (!ticket.assigned_to) return '—'
    const p = profileMap[ticket.assigned_to]
    return p?.full_name || ticket.assigned_to?.slice(0, 8) || '—'
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 overflow-y-auto h-full">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Support and incidents linked to devices
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New ticket
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or device..."
            className="w-56 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={assignedToMe}
            onChange={(e) => setAssignedToMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Assigned to me</span>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden bg-zinc-50 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No tickets found</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">
              {tickets.length === 0 ? 'Create a ticket to get started.' : 'Try changing filters or search.'}
            </p>
            {tickets.length === 0 && (
              <Button variant="secondary" onClick={() => setCreateOpen(true)} className="mt-2">
                New ticket
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assigned to</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTicketId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTicketId(t.id)
                      }
                    }}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={t.title}>
                      {t.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={deviceLabel(t.items)}>
                      {deviceLabel(t.items)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.priority}>{t.priority}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {assigneeDisplay(t)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(t.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          setSelectedTicketId(id)
        }}
      />

      <TicketDrawer
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
      />
    </div>
  )
}
