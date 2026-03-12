import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, PackageSearch, PackageOpen } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import CopyButton from '../ui/CopyButton'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { calcDeviceAge, isThreeYearsOrOlder } from './ItemForm'

function fmt(date) {
  if (!date) return null
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const d = new Date(date)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

// ─── Column definitions with cell renderers ────────────────────────────────────
export const COLS = [
  {
    key: 'brand',
    label: 'Brand / Model',
    render: (item) => (
      <td className="px-4 py-3 max-w-52 border-r border-gray-200 dark:border-gray-800" title={[item.brand, item.model].filter(Boolean).join(' ') || undefined}>
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
          {item.brand} {item.model}
        </p>
      </td>
    ),
  },
  {
    key: 'serial_number',
    label: 'Serial #',
    render: (item) => (
      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={item.serial_number ?? undefined}>
        {item.serial_number
          ? <CopyButton value={item.serial_number}>
              <span className="text-gray-500 dark:text-gray-400">{item.serial_number}</span>
            </CopyButton>
          : <span className="text-gray-400 dark:text-gray-600">—</span>
        }
      </td>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    render: (item) => (
      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={item.category ?? undefined}>
        {item.category
          ? <Badge>{item.category}</Badge>
          : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>}
      </td>
    ),
  },
  {
    key: 'os',
    label: 'OS / RAM / SSD',
    render: (item) => (
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800" title={[item.os, item.ram, item.ssd].filter(Boolean).join(' · ') || undefined}>
        {[item.os, item.ram, item.ssd].filter(Boolean).join(' · ') || '—'}
      </td>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => (
      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={item.status ?? undefined}>
        {item.status
          ? <Badge variant={item.status}>{item.status}</Badge>
          : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>}
      </td>
    ),
  },
  {
    key: 'assigned_to',
    label: 'Assigned To',
    render: (item, extras) => {
      const name = extras?.profileMap?.[item.assigned_to]?.full_name ?? item.assigned_to
      return (
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs border-r border-gray-200 dark:border-gray-800" title={name ?? undefined}>
          {name ?? '—'}
        </td>
      )
    },
  },
  {
    key: 'branch',
    label: 'Branch',
    render: (item) => (
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs border-r border-gray-200 dark:border-gray-800" title={item.branch ?? undefined}>
        {item.branch ?? '—'}
      </td>
    ),
  },
  {
    key: 'doi',
    label: 'DOI',
    render: (item) => (
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800" title={item.doi ? fmt(item.doi) : undefined}>
        {item.doi ? fmt(item.doi) : '—'}
      </td>
    ),
  },
  {
    key: 'purchase_date',
    label: 'Purchase Date / Age',
    render: (item, { age, isOld, purchaseFmt }) => (
      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={purchaseFmt ? (age ? `${purchaseFmt} · ${age}` : purchaseFmt) : undefined}>
        {purchaseFmt ? (
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{purchaseFmt}</p>
            {age ? (
              <p className={`text-xs font-medium mt-0.5 ${isOld ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {age}{isOld && ' ⚠'}
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">future date</p>
            )}
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
        )}
      </td>
    ),
  },
  {
    key: 'ownership',
    label: 'Ownership',
    render: (item) => (
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800" title={item.ownership ?? undefined}>
        {item.ownership ?? '—'}
      </td>
    ),
  },
  {
    key: 'replacement_status',
    label: 'Replacement Status',
    render: (item, { effStatus }) => (
      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={effStatus}>
        <Badge variant={effStatus}>{effStatus}</Badge>
      </td>
    ),
  },
  {
    key: 'replacement_due',
    label: 'Replacement Due',
    render: (item, { effDue }) => (
      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-800" title={effDue ?? undefined}>
        {effDue
          ? <Badge variant={effDue}>{effDue}</Badge>
          : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>}
      </td>
    ),
  },
]

const COL_MAP = Object.fromEntries(COLS.map(c => [c.key, c]))

// Default column widths (px) for resizable virtualized table
const DEFAULT_COL_WIDTHS = {
  brand: 180,
  serial_number: 120,
  category: 100,
  os: 140,
  status: 100,
  assigned_to: 120,
  branch: 100,
  doi: 90,
  purchase_date: 140,
  ownership: 100,
  replacement_status: 130,
  replacement_due: 120,
}
const MIN_COL_WIDTH = 60
const MAX_COL_WIDTH = 400
const CHECKBOX_COL_WIDTH = 40
const ACTIONS_COL_WIDTH = 96

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-30 shrink-0" />
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 shrink-0" />
    : <ChevronDown className="w-3 h-3 shrink-0" />
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ItemTable({ items, onEdit, onDelete, sort, onSort, selected = new Set(), onSelect, onSelectAll, hasFilters = false, onClearFilters, hiddenCols = new Set(), onRowClick, scrollRef, density = 'default', onAddFirstItem }) {
  const { role } = useAuth()
  const { data: profiles = [] } = useProfiles()
  const profileMap = React.useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles])
  const isAdmin = role === 'admin'

  const [colOrder, setColOrder] = useState(() => COLS.map(c => c.key))
  const [dragSrc,  setDragSrc]  = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [colWidths, setColWidths] = useState(() => ({ ...DEFAULT_COL_WIDTHS }))
  const [resizing, setResizing] = useState({ colKey: null, startX: 0, startW: 0 })
  const focusedRowRef = useRef(null)

  useEffect(() => {
    if (focusedIdx >= 0 && focusedRowRef.current) {
      focusedRowRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [focusedIdx])

  useEffect(() => {
    if (!resizing.colKey) return
    document.body.classList.add('select-none')
    document.body.style.cursor = 'col-resize'
    const onMove = (e) => {
      const delta = e.clientX - resizing.startX
      const newW = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, resizing.startW + delta))
      setColWidths((prev) => ({ ...prev, [resizing.colKey]: newW }))
    }
    const onUp = () => setResizing({ colKey: null, startX: 0, startW: 0 })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('select-none')
      document.body.style.cursor = ''
    }
  }, [resizing.colKey, resizing.startX, resizing.startW])

  const handleKeyDown = useCallback((e) => {
    if (!items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIdx >= 0 && onRowClick) {
      e.preventDefault()
      onRowClick(items[focusedIdx])
    } else if (e.key === 'Escape') {
      setFocusedIdx(-1)
    }
  }, [items, focusedIdx, onRowClick])

  const orderedCols = colOrder.map(k => COL_MAP[k]).filter(c => c && !hiddenCols.has(c.key))

  const mobileScrollRef = useRef(null)
  const useMobileVirtual = items.length > 50
  const mobileRowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 140,
    overscan: 3,
  })
  const mobileVirtualItems = useMobileVirtual ? mobileRowVirtualizer.getVirtualItems() : null

  const desktopTbodyScrollRef = useRef(null)
  const useDesktopVirtual = items.length > 100
  const desktopRowHeight = density === 'compact' ? 38 : density === 'comfortable' ? 54 : 46
  const desktopRowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => desktopTbodyScrollRef.current,
    estimateSize: () => desktopRowHeight,
    overscan: 8,
  })
  const desktopVirtualItems = useDesktopVirtual ? desktopRowVirtualizer.getVirtualItems() : null

  function onDragStart(key) { setDragSrc(key) }
  function onDragEnter(key) { if (key !== dragSrc) setDragOver(key) }
  function startResize(colKey, e) {
    e.preventDefault()
    e.stopPropagation()
    setResizing({ colKey, startX: e.clientX, startW: colWidths[colKey] ?? DEFAULT_COL_WIDTHS[colKey] })
  }
  function onDragEnd() {
    if (dragSrc && dragOver) {
      setColOrder(prev => {
        const next = [...prev]
        const from = next.indexOf(dragSrc)
        const to   = next.indexOf(dragOver)
        next.splice(from, 1)
        next.splice(to, 0, dragSrc)
        return next
      })
    }
    setDragSrc(null)
    setDragOver(null)
  }

  const thBase = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none border-r border-gray-200 dark:border-gray-700 last:border-r-0'

  return (
    <div
      ref={scrollRef}
      className={`rounded-xl border border-gray-300 dark:border-gray-800 h-full outline-none flex flex-col min-h-0 ${useDesktopVirtual ? 'overflow-hidden' : 'overflow-auto'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => { if (focusedIdx < 0 && items.length > 0) setFocusedIdx(0) }}
    >
      {/* Mobile: card layout (visible on small screens only); virtualized when many items */}
      {items.length > 0 && (
        <div
          ref={mobileScrollRef}
          className="md:hidden h-full overflow-auto"
          aria-label="Inventory list"
        >
          <div
            className="p-3 relative"
            style={useMobileVirtual ? { height: `${mobileRowVirtualizer.getTotalSize() + 12}px` } : undefined}
          >
            {useMobileVirtual && mobileVirtualItems
              ? mobileVirtualItems.map((vr) => {
                  const item = items[vr.index]
                  const isSelected = selected.has(item.id)
                  return (
                    <div
                      key={item.id}
                      style={{ position: 'absolute', top: 0, left: 12, right: 12, transform: `translateY(${vr.start}px)` }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { setFocusedIdx(vr.index); onRowClick?.(item) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFocusedIdx(vr.index); onRowClick?.(item) } }}
                        className={`rounded-xl border p-4 transition-colors text-left mb-3 ${
                          isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.brand} {item.model}</p>
                            {item.serial_number && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{item.serial_number}</p>}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {item.status && <Badge variant={item.status}>{item.status}</Badge>}
                              {item.category && <Badge>{item.category}</Badge>}
                            </div>
                            {item.assigned_to && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Assigned to {profileMap[item.assigned_to]?.full_name ?? item.assigned_to}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {isAdmin && onSelect && (
                              <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.id)} aria-label={`Select ${item.model || item.brand}`} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                            )}
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="Edit item"><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => onDelete(item)} aria-label="Delete item" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              : items.map((item, idx) => {
                  const isSelected = selected.has(item.id)
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFocusedIdx(idx); onRowClick?.(item) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFocusedIdx(idx); onRowClick?.(item) } }}
                      className={`rounded-xl border p-4 transition-colors text-left mb-3 ${
                        isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.brand} {item.model}</p>
                          {item.serial_number && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{item.serial_number}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.status && <Badge variant={item.status}>{item.status}</Badge>}
                            {item.category && <Badge>{item.category}</Badge>}
                          </div>
                          {item.assigned_to && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Assigned to {profileMap[item.assigned_to]?.full_name ?? item.assigned_to}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {isAdmin && onSelect && (
                            <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.id)} aria-label={`Select ${item.model || item.brand}`} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                          )}
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="Edit item"><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => onDelete(item)} aria-label="Delete item" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>
        </div>
      )}

      {/* Desktop: table (hidden on small screens); virtualized when items > 100 */}
      {useDesktopVirtual ? (
        <div className="hidden md:flex flex-col flex-1 min-h-0 w-full overflow-x-auto">
          <table className="w-full text-sm flex-none table-fixed" data-density={density !== 'default' ? density : undefined} style={{ minWidth: (isAdmin && onSelect ? CHECKBOX_COL_WIDTH : 0) + orderedCols.reduce((s, c) => s + (colWidths[c.key] ?? DEFAULT_COL_WIDTHS[c.key]), 0) + (isAdmin ? ACTIONS_COL_WIDTH : 0) }}>
            <colgroup>
              {isAdmin && onSelect && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
              {orderedCols.map((col) => (
                <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] }} />
              ))}
              {isAdmin && <col style={{ width: ACTIONS_COL_WIDTH }} />}
            </colgroup>
            <thead className="bg-zinc-100 dark:bg-gray-800 text-left">
              <tr className="bg-zinc-100 dark:bg-gray-800 text-left">
                {isAdmin && onSelect && (
                  <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={items.length > 0 && items.every(i => selected.has(i.id))}
                      ref={el => { if (el) el.indeterminate = items.some(i => selected.has(i.id)) && !items.every(i => selected.has(i.id)) }}
                      onChange={() => onSelectAll(items)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                )}
                {orderedCols.map((col) => {
                  const active = sort?.col === col.key
                  const isDragging = dragSrc === col.key
                  const isOver = dragOver === col.key
                  return (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={() => onDragStart(col.key)}
                      onDragEnter={() => onDragEnter(col.key)}
                      onDragOver={e => e.preventDefault()}
                      onDragEnd={onDragEnd}
                      className={`${thBase} relative cursor-grab active:cursor-grabbing transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} ${isDragging ? 'opacity-40' : ''} ${isOver ? 'border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <button onClick={() => onSort(col.key)} className={`inline-flex items-center gap-1 pr-2 transition-colors hover:text-gray-800 dark:hover:text-gray-100 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                        {col.label}
                        <SortIcon active={active} dir={sort?.dir} />
                      </button>
                      <div
                        role="separator"
                        aria-label={`Resize ${col.label} column`}
                        draggable={false}
                        onMouseDown={(e) => startResize(col.key, e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 shrink-0 rounded-r"
                        style={{ touchAction: 'none' }}
                      />
                    </th>
                  )
                })}
                {isAdmin && <th className={thBase} />}
              </tr>
            </thead>
          </table>
          <div ref={desktopTbodyScrollRef} className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-sm table-fixed" data-density={density !== 'default' ? density : undefined} style={{ minWidth: (isAdmin && onSelect ? CHECKBOX_COL_WIDTH : 0) + orderedCols.reduce((s, c) => s + (colWidths[c.key] ?? DEFAULT_COL_WIDTHS[c.key]), 0) + (isAdmin ? ACTIONS_COL_WIDTH : 0) }}>
              <colgroup>
                {isAdmin && onSelect && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
                {orderedCols.map((col) => (
                  <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] }} />
                ))}
                {isAdmin && <col style={{ width: ACTIONS_COL_WIDTH }} />}
              </colgroup>
              <tbody
                className="divide-y divide-gray-200 dark:divide-gray-800"
                style={{ height: desktopRowVirtualizer.getTotalSize() }}
              >
                {desktopVirtualItems.length > 0 && desktopVirtualItems[0].start > 0 && (
                  <tr>
                    <td
                      colSpan={(isAdmin && onSelect ? 1 : 0) + orderedCols.length + (isAdmin ? 1 : 0)}
                      style={{ height: desktopVirtualItems[0].start, padding: 0, border: 'none', lineHeight: 0, verticalAlign: 'top' }}
                      aria-hidden
                    />
                  </tr>
                )}
                {desktopVirtualItems.map((vr) => {
                  const item = items[vr.index]
                  const idx = vr.index
                  const age = calcDeviceAge(item.purchase_date)
                  const isOld = isThreeYearsOrOlder(item.purchase_date)
                  const purchaseFmt = fmt(item.purchase_date)
                  const effStatus = (item.replacement_status === 'True' || isOld) ? 'True' : 'False'
                  const effDue = item.replacement_due || (isOld ? 'Pending' : '')
                  const extras = { age, isOld, purchaseFmt, effStatus, effDue, profileMap }
                  const isSelected = selected.has(item.id)
                  const isFocused = idx === focusedIdx
                  return (
                    <tr
                      key={item.id}
                      ref={isFocused ? (el) => { focusedRowRef.current = el } : undefined}
                      style={{ height: vr.size }}
                      onClick={() => { setFocusedIdx(idx); onRowClick?.(item) }}
                      className={`group transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${isFocused ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'bg-zinc-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      {isAdmin && onSelect && (
                        <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-800 w-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </td>
                      )}
                      {orderedCols.map((col) => {
                        const cell = col.render(item, extras)
                        return React.cloneElement(cell, { key: col.key })
                      })}
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap w-24" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => onEdit(item)} title="Edit" aria-label="Edit item"><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete(item)} title="Delete" aria-label="Delete item" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {desktopVirtualItems.length > 0 && (() => {
                  const last = desktopVirtualItems[desktopVirtualItems.length - 1]
                  const remainder = desktopRowVirtualizer.getTotalSize() - (last.start + last.size)
                  if (remainder <= 0) return null
                  return (
                    <tr key="tail-spacer">
                      <td
                        colSpan={(isAdmin && onSelect ? 1 : 0) + orderedCols.length + (isAdmin ? 1 : 0)}
                        style={{ height: remainder, padding: 0, border: 'none', lineHeight: 0, verticalAlign: 'top' }}
                        aria-hidden
                      />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <table className="w-full text-sm hidden md:table" data-density={density !== 'default' ? density : undefined}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-100 dark:bg-gray-800 text-left">
              {isAdmin && onSelect && (
                <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={items.length > 0 && items.every(i => selected.has(i.id))}
                    ref={el => { if (el) el.indeterminate = items.some(i => selected.has(i.id)) && !items.every(i => selected.has(i.id)) }}
                    onChange={() => onSelectAll(items)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                </th>
              )}
              {orderedCols.map((col) => {
                const active     = sort?.col === col.key
                const isDragging = dragSrc  === col.key
                const isOver     = dragOver === col.key
                return (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={() => onDragStart(col.key)}
                    onDragEnter={() => onDragEnter(col.key)}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={onDragEnd}
                    className={`${thBase} cursor-grab active:cursor-grabbing transition-colors
                      ${active     ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
                      ${isDragging ? 'opacity-40' : ''}
                      ${isOver     ? 'border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <button
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-gray-800 dark:hover:text-gray-100 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`}
                    >
                      {col.label}
                      <SortIcon active={active} dir={sort?.dir} />
                    </button>
                  </th>
                )
              })}
              {isAdmin && <th className={thBase} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {items.map((item, idx) => {
              const age        = calcDeviceAge(item.purchase_date)
              const isOld      = isThreeYearsOrOlder(item.purchase_date)
              const purchaseFmt = fmt(item.purchase_date)
              const effStatus  = (item.replacement_status === 'True' || isOld) ? 'True' : 'False'
              const effDue     = item.replacement_due || (isOld ? 'Pending' : '')
              const extras     = { age, isOld, purchaseFmt, effStatus, effDue, profileMap }
              const isSelected = selected.has(item.id)
              const isFocused  = idx === focusedIdx
              return (
                <tr
                  key={item.id}
                  ref={isFocused ? (el) => { focusedRowRef.current = el } : undefined}
                  onClick={() => { setFocusedIdx(idx); onRowClick?.(item) }}
                  className={`group transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                    isFocused  ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500 scroll-mt-14' : ''
                  } ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'bg-zinc-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {isAdmin && onSelect && (
                    <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                    </td>
                  )}
                  {orderedCols.map((col) => {
                    const cell = col.render(item, extras)
                    return React.cloneElement(cell, { key: col.key })
                  })}
                  {isAdmin && (
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)} title="Edit" aria-label="Edit item"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(item)} title="Delete" aria-label="Delete item" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Empty state (shared for both table and mobile) */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          {hasFilters ? (
            <>
              <PackageSearch className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No items match your filters</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">Try broadening search or category, or clear filters to see all items.</p>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </>
          ) : (
            <>
              <PackageOpen className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No items yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">Add your first item or import a CSV to get started</p>
              {onAddFirstItem && (
                <button
                  type="button"
                  onClick={onAddFirstItem}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  Add your first item
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
