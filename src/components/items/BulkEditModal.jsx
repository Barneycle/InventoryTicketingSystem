import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useBulkUpdateItems } from '../../hooks/useItems'
import { useProfiles } from '../../hooks/useProfiles'
import { useToast } from '../../contexts/ToastContext'

const STATUSES       = ['Active', 'In Stock', 'Under Repair', 'Lost/Missing', 'Retired', 'Disposed']
const OWNERSHIPS     = ['Corporate', 'BYOD']
const REPL_STATUSES  = ['True', 'False']
const REPL_DUES      = ['Pending', 'Closed']

// Build fields: category and branch from DB; profileOptions = [{ value: id, label: name }]
function buildFields(categoryOptions = [], branchOptions = [], profileOptions = []) {
  return [
    { key: 'status',             label: 'Status',             type: 'select', options: STATUSES },
    { key: 'branch',             label: 'Branch',             type: 'select', options: branchOptions },
    { key: 'ownership',          label: 'Ownership',          type: 'select', options: OWNERSHIPS },
    { key: 'assigned_to',        label: 'Assigned To',        type: 'select', options: [{ value: '', label: '— Unassigned —' }, ...profileOptions] },
    { key: 'previous_user',      label: 'Previous User',     type: 'text' },
    { key: 'supplier',           label: 'Supplier',          type: 'text' },
    { key: 'category',          label: 'Category',            type: 'select', options: categoryOptions },
    { key: 'replacement_status', label: 'Replacement Status', type: 'select', options: REPL_STATUSES },
    { key: 'replacement_due',    label: 'Replacement Due',    type: 'select', options: REPL_DUES },
  ]
}

const inputCls  = 'block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const selectCls = inputCls

export default function BulkEditModal({ open, onClose, onSuccess, selectedIds, categoryOptions = [], branchOptions = [] }) {
  const bulkUpdate = useBulkUpdateItems()
  const toast = useToast()
  const { data: profiles = [] } = useProfiles()
  const profileOptions = profiles.map((p) => ({ value: p.id, label: (p.full_name?.trim() || p.id?.slice(0, 8) || p.id) }))
  const FIELDS = buildFields(categoryOptions, branchOptions, profileOptions)

  // For each field track: enabled (bool) + value (string)
  const [fields, setFields] = useState(() =>
    Object.fromEntries(FIELDS.map(f => [f.key, { enabled: false, value: '' }]))
  )
  const [error, setError] = useState('')

  function toggle(key) {
    setFields(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))
  }
  function setValue(key, value) {
    setFields(prev => ({ ...prev, [key]: { ...prev[key], value } }))
  }

  const enabledCount = Object.values(fields).filter(f => f.enabled).length

  async function handleSubmit(e) {
    e.preventDefault()
    const updates = {}
    for (const [key, { enabled, value }] of Object.entries(fields)) {
      if (enabled) updates[key] = value || null
    }
    if (!Object.keys(updates).length) return
    setError('')
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, updates })
      toast(`${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} updated`)
      onSuccess ? onSuccess() : onClose()
    } catch (err) {
      setError(err.message ?? 'Bulk update failed.')
    }
  }

  function handleClose() { setError(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit ${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''}`} size="sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Toggle a field to include it. Only toggled fields will be updated — everything else stays as-is.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2">
        {FIELDS.map(f => {
          const { enabled, value } = fields[f.key]
          return (
            <div key={f.key} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${enabled ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggle(f.key)}
                className={`w-9 h-5 rounded-full flex items-center transition-colors shrink-0 ${enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>

              {/* Label */}
              <span className="w-32 shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">{f.label}</span>

              {/* Input */}
              <div className="flex-1">
                {f.type === 'text' && (
                  <input
                    value={value}
                    onChange={e => setValue(f.key, e.target.value)}
                    disabled={!enabled}
                    placeholder={`Set ${f.label.toLowerCase()}…`}
                    className={inputCls}
                  />
                )}
                {f.type === 'select' && (
                  <select value={value} onChange={e => setValue(f.key, e.target.value)} disabled={!enabled} className={selectCls}>
                    {f.options.map((o) => {
                      const val = typeof o === 'object' && o !== null && 'value' in o ? o.value : o
                      const label = typeof o === 'object' && o !== null && 'label' in o ? o.label : o
                      return <option key={val} value={val}>{label}</option>
                    })}
                  </select>
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <p className="text-xs text-red-500 pt-1">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={bulkUpdate.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={bulkUpdate.isPending} disabled={enabledCount === 0}>
            {bulkUpdate.isPending ? 'Saving…' : `Apply to ${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
