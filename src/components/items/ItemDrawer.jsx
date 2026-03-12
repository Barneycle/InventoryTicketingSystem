import { useEffect, useState } from 'react'
import { X, User, Monitor, HardDrive, Tag, Wrench, History, Clock, Ticket } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import CreateTicketModal from '../tickets/CreateTicketModal'
import CopyButton from '../ui/CopyButton'
import { useProfiles } from '../../hooks/useProfiles'
import { calcDeviceAge, isThreeYearsOrOlder } from './ItemForm'
import { useItemHistory } from '../../hooks/useActivityLog'


function fmt(date) {
  if (!date) return '—'
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const d = new Date(date)
  return isNaN(d) ? '—' : d.toISOString().slice(0, 10)
}

function Field({ label, value, mono = false, copyable = false }) {
  if (!value && value !== 0) return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      {copyable
        ? (
          <CopyButton value={value}>
            <span className={`text-sm text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
          </CopyButton>
        ) : (
          <span className={`text-sm text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
        )
      }
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-800">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toISOString().slice(0, 10)
}

function HistoryTab({ itemId }) {
  const { data: log, isLoading } = useItemHistory(itemId)

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!log?.length) return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <History className="w-8 h-8 text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No history recorded</p>
      <p className="text-xs text-gray-400 dark:text-gray-600">Activity will appear here after edits or deletions</p>
    </div>
  )

  return (
    <ul className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
      {log.map(entry => (
        <li key={entry.id} className="flex items-start gap-3 py-3">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            <Clock className="w-3 h-3 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={entry.action}>{entry.action}</Badge>
              <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(entry.created_at)}</span>
            </div>
            {entry.details && Object.keys(entry.details).length > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                {Object.entries(entry.details).filter(([k]) => k !== 'name').map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function ItemDrawer({ item, onClose }) {
  const open = !!item
  const [tab, setTab] = useState('overview')
  const [createTicketOpen, setCreateTicketOpen] = useState(false)
  const { data: profiles = [] } = useProfiles()
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
  const assigneeDisplay = item?.assigned_to ? (profileMap[item.assigned_to]?.full_name ?? item.assigned_to) : null

  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Reset to overview when item changes
  useEffect(() => { setTab('overview') }, [item?.id])

  if (!item) return null

  const age = calcDeviceAge(item.purchase_date)
  const isOld = isThreeYearsOrOlder(item.purchase_date)
  const effStatus = (item.replacement_status === 'True' || isOld) ? 'True' : 'False'
  const effDue = item.replacement_due || (isOld ? 'Pending' : null)

  const tabBtn = (key, label) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        tab === key
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-zinc-50 dark:bg-gray-900 shadow-2xl border-l border-gray-300 dark:border-gray-800 flex flex-col animate-[fadeSlideRight_0.22s_ease_forwards]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 truncate">
              {item.brand} {item.model}
            </h2>
            {item.serial_number && (
              <CopyButton value={item.serial_number} className="mt-0.5">
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{item.serial_number}</span>
              </CopyButton>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status badges + Create ticket */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          {item.status && <Badge variant={item.status}>{item.status}</Badge>}
          {item.category && <Badge>{item.category}</Badge>}
          {item.branch && <Badge>{item.branch}</Badge>}
          {isOld && <Badge variant="Pending">≥ 3 yrs old</Badge>}
          <Button variant="secondary" size="sm" onClick={() => setCreateTicketOpen(true)} className="ml-auto">
            <Ticket className="w-3.5 h-3.5" />
            Create ticket
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0 px-2">
          {tabBtn('overview', 'Overview')}
          {tabBtn('history', 'History')}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === 'overview' ? (
            <div className="space-y-6">
              <Section icon={Tag} title="Identity">
                <Field label="Brand" value={item.brand} />
                <Field label="Model" value={item.model} />
                <Field label="Serial #" value={item.serial_number} mono copyable />
                <Field label="Category" value={item.category} />
              </Section>

              <Section icon={Monitor} title="Specs">
                <Field label="OS" value={item.os} />
                <Field label="RAM" value={item.ram} />
                <Field label="SSD" value={item.ssd} />
              </Section>

              <Section icon={User} title="Assignment">
                <Field label="Assigned To" value={assigneeDisplay ?? item.assigned_to} />
                <Field label="Branch" value={item.branch} />
                <Field label="Date of Issue" value={fmt(item.doi)} />
                <Field label="Previous User" value={item.previous_user} />
              </Section>

              <Section icon={HardDrive} title="Administration">
                <Field label="Purchase Date" value={fmt(item.purchase_date)} />
                <Field label="Device Age" value={age} />
                <Field label="Supplier" value={item.supplier} />
                <Field label="Invoice #" value={item.invoice_number} mono copyable />
                <Field label="Ownership" value={item.ownership} />
              </Section>

              <Section icon={Wrench} title="Replacement">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Status</span>
                  <Badge variant={effStatus}>{effStatus}</Badge>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Due</span>
                  {effDue ? <Badge variant={effDue}>{effDue}</Badge> : <span className="text-xs text-gray-400">—</span>}
                </div>
              </Section>
            </div>
          ) : (
            <HistoryTab itemId={item.id} />
          )}
        </div>
      </div>

      <CreateTicketModal
        open={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        onCreated={() => setCreateTicketOpen(false)}
      />
    </>
  )
}
