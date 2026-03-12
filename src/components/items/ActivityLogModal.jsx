import { Clock } from 'lucide-react'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import { useActivityLog } from '../../hooks/useActivityLog'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const d = new Date(dateStr)
  return isNaN(d) ? dateStr : d.toISOString().slice(0, 10)
}

export default function ActivityLogModal({ open, onClose }) {
  const { data: log, isLoading } = useActivityLog()

  return (
    <Modal open={open} onClose={onClose} title="Activity Log">
      <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-800">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {log ? `${log.length} entr${log.length === 1 ? 'y' : 'ies'}` : 'Loading…'}
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !log?.length ? (
        <p className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {log.map(entry => (
            <li key={entry.id} className="flex items-center gap-4 py-3">
              <Badge variant={entry.action}>{entry.action}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100 truncate font-medium">
                  {entry.item_name ?? 'Unknown item'}
                </p>
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                {timeAgo(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
