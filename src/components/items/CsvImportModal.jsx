import { useState, useRef } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { useToast } from '../../contexts/ToastContext'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

// ─── CSV parser (handles quoted fields) ───────────────────────────────────────

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (!lines.length) return { headers: [], rows: [] }

  function parseLine(line) {
    const fields = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        fields.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur)
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

// ─── Column mapping (case-insensitive) ────────────────────────────────────────

// Maps normalised header → DB column (null = skip)
const HEADER_MAP = {
  'emp id #':      null,
  'emp id':        null,
  'emp name':      'assigned_to',
  'brand':         'brand',
  'model':         'model',
  'serial #':      'serial_number',
  'serial no':     'serial_number',
  'serial number': 'serial_number',
  'os':            'os',
  'ram':           'ram',
  'ssd':           'ssd',
  'jc sync':       null,
  'cs sync':       null,
  'doi':           'doi',
  'dop':           'purchase_date',
  'date of purchase': 'purchase_date',
  'ytd':           null,
  'previous user': 'previous_user',
  'supplier':      'supplier',
  'branch':        'branch',
  'remarks':       'status',
  'status':        'status',
  'invoice':       'invoice_number',
  'invoice number':'invoice_number',
  'invoice no':    'invoice_number',
  'ownership':     'ownership',
}

const BRANCH_NORM = { australia: 'Australia', makati: 'Makati', laoag: 'Laoag' }
const STATUS_NORM = {
  active: 'Active',
  'in stock': 'In Stock',
  instock: 'In Stock',
  'under repair': 'Under Repair',
  repair: 'Under Repair',
  'lost/missing': 'Lost/Missing',
  lost: 'Lost/Missing',
  missing: 'Lost/Missing',
  retired: 'Retired',
  disposed: 'Disposed',
}

function parseDate(val) {
  if (!val) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  // MM/DD/YYYY or similar
  const d = new Date(val)
  if (!isNaN(d)) return d.toISOString().split('T')[0]
  return null
}

function mapRow(rawRow) {
  const out = {}
  for (const [rawHeader, val] of Object.entries(rawRow)) {
    const key = rawHeader.toLowerCase().trim()
    const dbCol = HEADER_MAP[key]
    if (!dbCol) continue
    if (dbCol === 'branch') {
      out[dbCol] = BRANCH_NORM[val.toLowerCase()] ?? (val || null)
    } else if (dbCol === 'status') {
      out[dbCol] = STATUS_NORM[val.toLowerCase()] ?? (val || null)
    } else if (dbCol === 'doi' || dbCol === 'purchase_date') {
      out[dbCol] = parseDate(val)
    } else {
      out[dbCol] = val || null
    }
  }
  return out
}

// Resolve "Assigned To" from CSV (name or email) to profile id for DB. Returns null if no match or ambiguous.
function resolveAssignedTo(profiles, value) {
  const v = (value ?? '').trim()
  if (!v) return null
  const vLower = v.toLowerCase()
  // If value looks like a UUID and matches a profile, use it
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  if (uuidLike) {
    const p = profiles.find((pr) => pr.id === v)
    if (p) return p.id
  }
  // Match by full_name (case-insensitive)
  const byName = profiles.filter(
    (p) => (p.full_name ?? '').trim().toLowerCase() === vLower
  )
  if (byName.length === 1) return byName[0].id
  // Match by email if profiles have email
  if (profiles.some((p) => p.email != null)) {
    const byEmail = profiles.filter(
      (p) => (p.email ?? '').trim().toLowerCase() === vLower
    )
    if (byEmail.length === 1) return byEmail[0].id
  }
  return null
}

const BATCH_TIMEOUT_MS = 20000

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

// Insert in batches to avoid request size limits; onProgress(inserted, total) called after each batch
async function batchInsert(rows, userId, onProgress) {
  const BATCH = 50
  const total = rows.length
  let inserted = 0
  onProgress?.(0, total)
  for (let i = 0; i < rows.length; i += BATCH) {
    if (i > 0) await new Promise(r => setTimeout(r, 120))
    const chunk = rows.slice(i, i + BATCH)
    const res = await withTimeout(
      supabase.from('items').insert(chunk),
      BATCH_TIMEOUT_MS,
      'Import timed out. Try importing fewer rows (e.g. 50–100 at a time).'
    )
    if (res?.error) throw res.error
    inserted += chunk.length
    onProgress?.(inserted, total)
  }
  supabase.from('activity_log').insert({
    user_id: userId,
    action: 'import',
    item_name: `CSV import (${inserted} items)`,
    details: { count: inserted },
  }).then(({ error }) => {
    if (error) console.warn('[CsvImport] activity_log insert failed:', error.message)
  })
  return inserted
}

// ─── Preview table ─────────────────────────────────────────────────────────────

const PREVIEW_COLS = [
  { key: 'brand',        label: 'Brand' },
  { key: 'model',        label: 'Model' },
  { key: 'serial_number',label: 'Serial #' },
  { key: 'status',       label: 'Status' },
  { key: 'assigned_to',  label: 'Assigned To' },
  { key: 'branch',       label: 'Branch' },
  { key: 'os',           label: 'OS' },
  { key: 'ram',          label: 'RAM' },
  { key: 'ssd',          label: 'SSD' },
  { key: 'doi',          label: 'DOI' },
  { key: 'purchase_date',label: 'Purchase Date' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CsvImportModal({ open, onClose }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileRef = useRef(null)
  const { data: profiles = [] } = useProfiles()

  const [step, setStep] = useState('upload') // upload | preview | done
  const [rows, setRows] = useState([])
  const [unmappedHeaders, setUnmappedHeaders] = useState([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })

  function reset() {
    setStep('upload')
    setRows([])
    setUnmappedHeaders([])
    setParseError('')
    setImportError('')
    setImportedCount(0)
    setImportProgress({ current: 0, total: 0 })
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const { headers, rows: rawRows } = parseCsv(text)

      if (!rawRows.length) {
        setParseError('The file appears to be empty or could not be parsed.')
        return
      }

      const mapped = rawRows.map(mapRow)
      const unmapped = headers.filter(h => {
        const k = h.toLowerCase().trim()
        return HEADER_MAP[k] === undefined
      })

      setRows(mapped)
      setUnmappedHeaders(unmapped)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!user?.id) {
      setImportError('You must be signed in to import.')
      return
    }
    setImporting(true)
    setImportError('')
    setImportProgress({ current: 0, total: rows.length })
    try {
      const resolvedRows = rows.map((row) => ({
        ...row,
        assigned_to: resolveAssignedTo(profiles, row.assigned_to),
      }))
      const unresolvedCount = rows.filter(
        (r) => (r.assigned_to ?? '').trim() && resolveAssignedTo(profiles, r.assigned_to) == null
      ).length
      const count = await batchInsert(resolvedRows, user.id, (current, total) => {
        setImportProgress({ current, total })
      })
      setImportedCount(count)
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
      setStep('done')
      toast(`${count} item${count !== 1 ? 's' : ''} imported successfully`)
      if (unresolvedCount > 0) {
        toast(`${unresolvedCount} row${unresolvedCount !== 1 ? 's' : ''} had no matching user for Assigned To (left unassigned).`, 'info')
      }
    } catch (err) {
      setImportError(err.message ?? 'Import failed.')
    } finally {
      setImporting(false)
      setImportProgress({ current: 0, total: 0 })
    }
  }

  const thClass = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'
  const tdClass = 'px-3 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-32 truncate'

  return (
    <Modal open={open} onClose={handleClose} title="Import from CSV" size="lg">
      {/* ── Upload step ── */}
      {step === 'upload' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Export your Google Sheet as <strong className="text-gray-700 dark:text-gray-300">File → Download → CSV</strong>, then upload it here.
          </p>

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
            <Upload className="w-8 h-8 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Click to choose a <strong>.csv</strong> file</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>

          {parseError && (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {parseError}
            </p>
          )}

          {/* Column reference */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recognised columns</p>
            <div className="flex flex-wrap gap-1.5">
              {['EMP NAME', 'MODEL', 'SERIAL #', 'OS', 'RAM', 'SSD', 'DOI', 'DOP', 'PREVIOUS USER', 'SUPPLIER', 'BRANCH', 'REMARKS'].map(h => (
                <span key={h} className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-mono">
                  {h}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Unrecognised columns are ignored. Column names are case-insensitive.</p>
          </div>
        </div>
      )}

      {/* ── Preview step ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Always-visible status when importing */}
          {importing && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-4 py-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Importing… {importProgress.current} / {importProgress.total} rows
              </p>
              <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: importProgress.total ? `${(100 * importProgress.current) / importProgress.total}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {importError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{importError}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''} ready to import.
            </p>
            <button onClick={reset} disabled={importing} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              ← Choose different file
            </button>
          </div>

          {unmappedHeaders.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                These columns were not recognised and will be skipped:{' '}
                <strong>{unmappedHeaders.join(', ')}</strong>
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Showing first 10 rows. The <strong>Brand</strong> column will be blank if not present in your sheet — you can fill it in after import.
          </p>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-800 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr>
                  {PREVIEW_COLS.map(c => <th key={c.key} className={thClass}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="bg-zinc-50 dark:bg-gray-900">
                    {PREVIEW_COLS.map(c => (
                      <td key={c.key} className={tdClass} title={row[c.key] ?? ''}>
                        {row[c.key] ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              +{rows.length - 10} more rows not shown
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={handleClose} disabled={importing}>Cancel</Button>
            <Button variant="primary" onClick={handleImport} loading={importing} disabled={importing}>
              {importing ? `Importing ${importProgress.current}/${importProgress.total}…` : `Import ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Done step ── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">Import complete</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {importedCount} item{importedCount !== 1 ? 's' : ''} added to inventory.
            </p>
          </div>
          <Button variant="primary" onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  )
}
