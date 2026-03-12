import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Button from '../ui/Button'

const STATUSES = ['Active', 'In Stock', 'Under Repair', 'Lost/Missing', 'Retired', 'Disposed']
const OWNERSHIPS = ['Corporate', 'BYOD']
const REPLACEMENT_DUE_OPTIONS = ['Pending', 'Closed']

// ─── Device age helpers ────────────────────────────────────────────────────

const TZ = 'Australia/Sydney'

// Get today's date as a plain local Date object in Sydney time.
// en-CA locale produces YYYY-MM-DD which is easy to split.
function getSydneyToday() {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Parse a 'YYYY-MM-DD' string as a plain local Date (no UTC shift).
function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function calcDeviceAge(purchaseDateStr) {
  if (!purchaseDateStr) return null
  const purchase = parseLocalDate(purchaseDateStr)
  const now = getSydneyToday()

  // Future date — no age yet
  if (purchase > now) return null

  let years = now.getFullYear() - purchase.getFullYear()
  let months = now.getMonth() - purchase.getMonth()
  let days = now.getDate() - purchase.getDate()

  if (days < 0) {
    months -= 1
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) parts.push(`${years}y`)
  if (months > 0) parts.push(`${months}m`)
  if (days > 0) parts.push(`${days}d`)
  return parts.length ? parts.join(' ') : '< 1d'
}

export function isThreeYearsOrOlder(purchaseDateStr) {
  if (!purchaseDateStr) return false
  const purchase = parseLocalDate(purchaseDateStr)
  const today = getSydneyToday()
  const threshold = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate())
  return purchase <= threshold
}


// ─── Helpers ──────────────────────────────────────────────────────────────

const empty = {
  brand: '',
  model: '',
  serial_number: '',
  category: '',
  os: '',
  ram: '',
  ssd: '',
  status: '',
  assigned_to: '',
  doi: '',
  branch: '',
  previous_user: '',
  purchase_date: '',
  ownership: '',
  invoice_number: '',
  supplier: '',
  replacement_status: 'False',
  replacement_due: '',
}

const base = 'block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-zinc-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'

function inputClass(hasError) {
  return `${base} ${hasError ? 'border-red-500' : 'border-gray-400 dark:border-gray-700'}`
}

function selectClass(hasError) {
  return `${base} ${hasError ? 'border-red-500' : 'border-gray-400 dark:border-gray-700'}`
}

function readOnlyClass() {
  return 'block w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed'
}

// Label-left / input-right row (required = asterisk + "Required"; optional = "(optional)" when no hint)
function Row({ label, hint, error, required, optional, children }) {
  const hintText = required ? 'Required' : (hint ?? (optional ? '(optional)' : ''))
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-none">
          {label}{required && <span className="text-red-500 dark:text-red-400" aria-hidden="true"> *</span>}
        </span>
        {hintText && (
          <span className="block text-xs text-gray-400 dark:text-gray-600 mt-0.5 italic">{hintText}</span>
        )}
      </div>
      <div className="w-52 min-w-0">
        {children}
        {error && <p className="text-xs text-red-500 mt-1" role="alert">{error}</p>}
      </div>
    </div>
  )
}

// Collapsible section: title + optional defaultOpen
function Section({ id, title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-300 dark:border-gray-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={open}
        aria-controls={id}
        id={`${id}-heading`}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        {title}
      </button>
      <div id={id} role="region" aria-labelledby={`${id}-heading`} className={open ? 'p-4 space-y-2.5 border-t border-gray-200 dark:border-gray-800' : 'hidden'}>
        {children}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ItemForm({ item, existingCategories = [], existingBranches = [], existingOsOptions = [], existingItems = [], existingProfiles = [], onSubmit, onCancel, onDirtyChange, loading }) {
  // Determine if the item's current category is a custom one not in the DB list
  const initIsOther = item?.category && !existingCategories.includes(item.category)

  const [form, setForm] = useState(() => {
    const base = { ...empty, ...(item ?? {}), category: initIsOther ? '__other__' : (item?.category ?? ''), status: item?.status ?? '' }
    return { ...base }
  })
  const [customCategory, setCustomCategory] = useState(initIsOther ? (item?.category ?? '') : '')
  const [errors, setErrors] = useState({})

  const deviceAge = calcDeviceAge(form.purchase_date)
  const isOld = isThreeYearsOrOlder(form.purchase_date)

  // When purchase_date changes: recalculate status and auto-set due to Pending if blank
  useEffect(() => {
    if (form.replacement_due === 'Closed') return
    const old = isThreeYearsOrOlder(form.purchase_date)
    setForm(prev => ({
      ...prev,
      replacement_status: old ? 'True' : 'False',
      replacement_due: old ? (prev.replacement_due || 'Pending') : prev.replacement_due,
    }))
  }, [form.purchase_date]) // eslint-disable-line react-hooks/exhaustive-deps

  // When replacement_due changes: enforce status consistency
  useEffect(() => {
    if (form.replacement_due === 'Closed') {
      setForm(prev => ({ ...prev, replacement_status: 'False' }))
    } else if (form.replacement_due === 'Pending') {
      setForm(prev => ({ ...prev, replacement_status: 'True' }))
    } else {
      // None — recalculate status from age
      setForm(prev => ({
        ...prev,
        replacement_status: isThreeYearsOrOlder(prev.purchase_date) ? 'True' : 'False',
      }))
    }
  }, [form.replacement_due]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
    onDirtyChange?.(true)
  }

  // All known categories (from DB), lowercase for comparison
  const allKnown = existingCategories.map(c => (typeof c === 'string' ? c : c?.name ?? ''))
  const customTrimmed = customCategory.trim()
  const norm = s => s.toLowerCase().trim().replace(/s$/i, '')
  const customDuplicate = form.category === '__other__' &&
    customTrimmed.length > 0 &&
    allKnown.some(c => norm(c) === norm(customTrimmed))

  function validate() {
    const errs = {}
    if (!(form.brand ?? '').trim()) errs.brand = 'Brand is required'
    if (!(form.model ?? '').trim()) errs.model = 'Model is required'
    if (form.category === '__other__') {
      if (!customTrimmed) errs.category = 'Please enter a category name.'
      else if (customDuplicate) errs.category = `"${customTrimmed}" already exists (or is a plural of an existing category) — select it from the dropdown.`
    }
    const sn = (form.serial_number ?? '').trim()
    if (sn) {
      const list = existingItems ?? []
      const duplicate = list.find(
        i => i.serial_number?.trim().toLowerCase() === sn.toLowerCase() && i.id !== item?.id
      )
      if (duplicate) {
        errs.serial_number = `Already used by ${[duplicate.brand, duplicate.model].filter(Boolean).join(' ')}${duplicate.assigned_to ? ` — assigned to ${duplicate.assigned_to}` : ''}`
      }
    }
    return errs
  }

  function validateField(field) {
    const errs = validate()
    return errs[field] ?? ''
  }

  function handleBlur(field) {
    const msg = validateField(field)
    setErrors(prev => (msg ? { ...prev, [field]: msg } : { ...prev, [field]: '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const t = v => (v ?? '').trim()
    onSubmit({
      brand: t(form.brand),
      model: t(form.model),
      serial_number: t(form.serial_number) || null,
      category: form.category === '__other__' ? (customTrimmed || null) : (t(form.category) || null),
      os: t(form.os) || null,
      ram: t(form.ram) || null,
      ssd: t(form.ssd) || null,
      status: form.status || null,
      assigned_to: t(form.assigned_to) || null,
      doi: form.doi || null,
      branch: form.branch || null,
      previous_user: t(form.previous_user) || null,
      purchase_date: form.purchase_date || null,
      ownership: form.ownership || null,
      invoice_number: t(form.invoice_number) || null,
      supplier: t(form.supplier) || null,
      replacement_status: form.replacement_status,
      replacement_due: form.replacement_due || null,
    })
  }

  const errorCount = Object.keys(errors).filter(k => errors[k]).length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 max-h-[70vh] sm:max-h-[80vh]">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 p-1">
        {/* Validation summary */}
        {errorCount > 0 && (
          <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-800 dark:text-red-200" role="alert">
            Please fix {errorCount} error{errorCount !== 1 ? 's' : ''}.
          </div>
        )}

        {/* ── Basic info (Identity) ───────────────────── */}
        <Section id="item-form-identity" title="Basic info" defaultOpen={true}>
          <Row label="Brand" required error={errors.brand}>
            <input
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
              onBlur={() => handleBlur('brand')}
              placeholder="e.g. Dell, HP, Logitech"
              className={inputClass(!!errors.brand)}
              aria-invalid={!!errors.brand}
            />
          </Row>
          <Row label="Model" required error={errors.model}>
            <input
              value={form.model}
              onChange={e => set('model', e.target.value)}
              onBlur={() => handleBlur('model')}
              placeholder="e.g. Latitude 5540, MX Master 3"
              className={inputClass(!!errors.model)}
              aria-invalid={!!errors.model}
            />
          </Row>
          <Row label="Serial No." optional error={errors.serial_number}>
            <input
              value={form.serial_number}
              onChange={e => set('serial_number', e.target.value)}
              onBlur={() => handleBlur('serial_number')}
              placeholder="e.g. SN-00123"
              className={inputClass(!!errors.serial_number)}
              aria-invalid={!!errors.serial_number}
            />
          </Row>
          <Row label="Category" required={form.category === '__other__'} optional={form.category !== '__other__'} error={errors.category}>
            <div className="space-y-1.5">
              <select
                value={form.category}
                onChange={e => { set('category', e.target.value); if (e.target.value !== '__other__') setCustomCategory('') }}
                onBlur={() => handleBlur('category')}
                className={selectClass(!!errors.category)}
                aria-invalid={!!errors.category}
              >
                <option value="">— None —</option>
                {existingCategories.map(c => {
                  const name = typeof c === 'string' ? c : (c?.name ?? '')
                  return <option key={name} value={name}>{name}</option>
                })}
                <option value="__other__">Other…</option>
              </select>
              {form.category === '__other__' && (
                <input
                  value={customCategory}
                  onChange={e => { setCustomCategory(e.target.value); if (errors.category) setErrors(prev => ({ ...prev, category: '' })) }}
                  onBlur={() => handleBlur('category')}
                  placeholder="Enter new category name"
                  autoFocus
                  className={inputClass(!!errors.category)}
                  aria-invalid={!!errors.category}
                />
              )}
              {form.category === '__other__' && customDuplicate && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  "{customTrimmed}" already exists — select it from the dropdown instead.
                </p>
              )}
            </div>
          </Row>
        </Section>

        {/* ── Hardware (Specs) ────────────────────────── */}
        <Section id="item-form-specs" title="Hardware" defaultOpen={true}>
          <Row label="OS" optional>
            <select value={form.os} onChange={e => set('os', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {existingOsOptions.map(o => {
                const name = typeof o === 'string' ? o : (o?.name ?? '')
                return <option key={name} value={name}>{name}</option>
              })}
            </select>
          </Row>
          <Row label="RAM" optional>
            <select value={form.ram} onChange={e => set('ram', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {['4GB', '8GB', '16GB', '32GB', '64GB'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Row>
          <Row label="SSD" optional>
            <select value={form.ssd} onChange={e => set('ssd', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {['128GB', '256GB', '512GB', '1TB', '2TB'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Row>
        </Section>

        {/* ── Status & Assignment ─────────────────────── */}
        <Section id="item-form-status" title="Status &amp; Assignment" defaultOpen={false}>
          <Row label="Status" optional>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Row>
          <Row label="Assigned To" optional>
            <select value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)} className={selectClass(false)}>
              <option value="">— Unassigned —</option>
              {existingProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name?.trim() || p.id?.slice(0, 8) || p.id}
                </option>
              ))}
            </select>
          </Row>
          <Row label="DOI" optional>
            <input type="date" value={form.doi} onChange={e => set('doi', e.target.value)} className={inputClass(false)} />
          </Row>
          <Row label="Branch" optional>
            <select value={form.branch} onChange={e => set('branch', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {existingBranches.map(b => {
                const name = typeof b === 'string' ? b : (b?.name ?? '')
                return <option key={name} value={name}>{name}</option>
              })}
            </select>
          </Row>
          <Row label="Previous User" optional>
            <input value={form.previous_user} onChange={e => set('previous_user', e.target.value)} placeholder="e.g. Jane Doe" className={inputClass(false)} />
          </Row>
        </Section>

        {/* ── Administration ──────────────────────────── */}
        <Section id="item-form-admin" title="Administration" defaultOpen={false}>
          <Row label="Purchase Date" optional>
            <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} className={inputClass(false)} />
          </Row>
          <Row label="Device Age">
            <div className="flex items-center gap-2">
              <input readOnly value={deviceAge ?? '—'} className={readOnlyClass()} tabIndex={-1} />
              {isOld && (
                <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                  ≥ 3 yrs
                </span>
              )}
            </div>
          </Row>
          <Row label="Invoice No." optional>
            <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="e.g. INV-2024-001" className={inputClass(false)} />
          </Row>
          <Row label="Supplier" optional>
            <input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="e.g. CDW, Dell Direct" className={inputClass(false)} />
          </Row>
          <Row label="Ownership" optional>
            <select value={form.ownership} onChange={e => set('ownership', e.target.value)} className={selectClass(false)}>
              <option value="">— Select —</option>
              {OWNERSHIPS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Row>
        </Section>

        {/* ── Replacement ──────────────────────────────── */}
        <Section id="item-form-replacement" title="Replacement" defaultOpen={true}>
          {isOld && form.replacement_due !== 'Closed' && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-1">
              Device is ≥ 3 years old — Status: <strong>True</strong>, Due: <strong>Pending</strong>. Set Due to <strong>Closed</strong> once replaced.
            </p>
          )}
          {form.replacement_due === 'Closed' && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mb-1">
              Replacement closed — Status set to <strong>False</strong>.
            </p>
          )}
          <Row label="Status" hint="auto / override">
            <select value={form.replacement_status} onChange={e => setForm(prev => ({ ...prev, replacement_status: e.target.value }))} className={selectClass(false)}>
              <option value="False">False</option>
              <option value="True">True</option>
            </select>
          </Row>
          <Row label="Due" optional>
            <select value={form.replacement_due} onChange={e => set('replacement_due', e.target.value)} className={selectClass(false)}>
              <option value="">— None —</option>
              {REPLACEMENT_DUE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Row>
        </Section>
      </div>

      {/* Sticky footer — Save/Cancel always visible */}
      <div className="shrink-0 flex justify-end gap-3 pt-4 pb-1 border-t border-gray-200 dark:border-gray-800 bg-zinc-50 dark:bg-gray-900 mt-auto">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
        </Button>
      </div>
    </form>
  )
}
