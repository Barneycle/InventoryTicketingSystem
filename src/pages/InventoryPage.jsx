import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Search, X, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2, SlidersHorizontal, Download, Keyboard, AlignJustify, ScrollText } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useItems, useDeleteItem, useBulkDeleteItems } from '../hooks/useItems'
import { useCategories } from '../hooks/useCategories'
import { useBranches } from '../hooks/useBranches'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { deleteItemsRpc } from '../lib/supabase'
import ItemTable, { COLS } from '../components/items/ItemTable'
import ItemTableSkeleton from '../components/items/ItemTableSkeleton'
import ItemModal from '../components/items/ItemModal'
import CsvImportModal from '../components/items/CsvImportModal'
import BulkEditModal from '../components/items/BulkEditModal'
import ItemDrawer from '../components/items/ItemDrawer'
import ActivityLogModal from '../components/items/ActivityLogModal'
import Button from '../components/ui/Button'
import { calcDeviceAge, isThreeYearsOrOlder } from '../components/items/ItemForm'

const STATUSES = ['Active', 'In Stock', 'Under Repair', 'Lost/Missing', 'Retired', 'Disposed']

export default function InventoryPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const toast = useToast()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const searchRef     = useRef(null)
  const colsMenuRef   = useRef(null)
  const densityRef    = useRef(null)
  const tableRef      = useRef(null)

  const { data: items, isLoading } = useItems()
  const { data: categories } = useCategories()
  const { data: branches } = useBranches()
  const categoryOptions = (categories ?? []).map(c => c.name)
  const branchOptions = (branches ?? []).map(b => b.name)
  const deleteItem = useDeleteItem()
  const bulkDelete = useBulkDeleteItems()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [bulkDeleteInProgress, setBulkDeleteInProgress] = useState(false)

  // Column visibility — Set of hidden column keys (persisted)
  const [hiddenCols, setHiddenCols] = useState(() => {
    try {
      const saved = localStorage.getItem('inventory-hidden-cols')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const [colsMenuOpen, setColsMenuOpen] = useState(false)

  // Quick-view drawer
  const [drawerItem, setDrawerItem] = useState(null)

  // Keyboard shortcuts help
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Activity log modal
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  // Row density (persisted)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('inventory-density') ?? 'default' } catch { return 'default' }
  })
  const [densityMenuOpen, setDensityMenuOpen] = useState(false)

  // Filter state (must be before useEffects that read/set them)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterReplacementDue, setFilterReplacementDue] = useState('')

  // Selection state — Set of item IDs
  const [selected, setSelected] = useState(new Set())

  function handleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelectAll(pageItems) {
    const allSelected = pageItems.every(i => selected.has(i.id))
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        pageItems.forEach(i => next.delete(i.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        pageItems.forEach(i => next.add(i.id))
        return next
      })
    }
  }

  function clearSelection() { setSelected(new Set()) }

  // Column toggle helpers
  function toggleCol(key) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (!colsMenuOpen) return
    function handleClick(e) {
      if (!colsMenuRef.current?.contains(e.target)) setColsMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colsMenuOpen])

  useEffect(() => {
    if (!densityMenuOpen) return
    function handleClick(e) {
      if (!densityRef.current?.contains(e.target)) setDensityMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [densityMenuOpen])

  // Apply initial filters from navigation state (e.g. drill-down from Reports page)
  // Debounce search input (250 ms) so filtering doesn't run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  // Apply filters from location.state (e.g. from Dashboard links)
  useEffect(() => {
    if (!location.state) return
    if (location.state.filterBranch) setFilterBranch(location.state.filterBranch)
    if (location.state.filterStatus) setFilterStatus(location.state.filterStatus)
    if (location.state.filterCategory) setFilterCategory(location.state.filterCategory)
    if (location.state.search) {
      setSearch(location.state.search)
      setSearchInput(location.state.search)
    }
    if (location.state.filterReplacementDue) setFilterReplacementDue(location.state.filterReplacementDue)
    window.history.replaceState({}, '', window.location.pathname)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters from URL search params (e.g. /inventory?status=Active&replacement_due=Pending)
  useEffect(() => {
    const status = searchParams.get('status')
    const branch = searchParams.get('branch')
    const category = searchParams.get('category')
    const replacementDue = searchParams.get('replacement_due')
    const q = searchParams.get('q')
    if (status) setFilterStatus(status)
    if (branch) setFilterBranch(branch)
    if (category) setFilterCategory(category)
    if (replacementDue) setFilterReplacementDue(replacementDue)
    if (q != null && q !== '') {
      setSearch(q)
      setSearchInput(q)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Export current filtered+sorted list as CSV
  function exportCsv() {
    const headers = ['Brand', 'Model', 'Serial #', 'Category', 'OS', 'RAM', 'SSD', 'Status',
      'Assigned To', 'Branch', 'DOI', 'Purchase Date', 'Device Age', 'Supplier',
      'Invoice #', 'Ownership', 'Replacement Status', 'Replacement Due', 'Previous User']
    const rows = sorted.map(item => {
      const isOld = isThreeYearsOrOlder(item.purchase_date)
      const effStatus = (item.replacement_status === 'True' || isOld) ? 'True' : 'False'
      const effDue    = item.replacement_due || (isOld ? 'Pending' : '')
      return [
        item.brand, item.model, item.serial_number, item.category, item.os, item.ram, item.ssd,
        item.status, item.assigned_to, item.branch, item.doi, item.purchase_date,
        calcDeviceAge(item.purchase_date), item.supplier, item.invoice_number, item.ownership,
        effStatus, effDue, item.previous_user,
      ].map(v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`)
    })
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${sorted.length} item${sorted.length !== 1 ? 's' : ''} to CSV`, 'success')
  }

  function handleBulkDelete() {
    const ids = [...selected]
    const count = ids.length
    setConfirmBulkDelete(false)
    clearSelection()

    // Optimistically hide all selected items
    setPendingDeleteIds(prev => new Set([...prev, ...ids]))

    // Schedule actual DB deletion after 8 s
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[bulk delete] running scheduled delete for ids:', ids.length, ids)
        const BATCH = 50
        for (let i = 0; i < ids.length; i += BATCH) {
          if (i > 0) await new Promise(r => setTimeout(r, 150))
          const chunk = ids.slice(i, i + BATCH)
          console.log('[bulk delete] calling delete_items RPC chunk', i / BATCH + 1, 'ids:', chunk.length)
          const { data, error } = await deleteItemsRpc(chunk)
          console.log('[bulk delete] delete_items response:', { data, error: error ? { message: error.message, code: error.code, details: error.details } : null })
          if (error) throw error
        }
        ids.forEach(id => pendingDeleteTimers.current.delete(id))
        await queryClient.invalidateQueries({ queryKey: ['items'] })
        await queryClient.invalidateQueries({ queryKey: ['activity_log'] })
        setPendingDeleteIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      } catch (err) {
        console.error('[bulk delete] failed:', err?.message, err)
        ids.forEach(id => pendingDeleteTimers.current.delete(id))
        setPendingDeleteIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
        queryClient.invalidateQueries({ queryKey: ['items'] })
        toast(err?.message ?? 'Delete failed. Run supabase-rls-allow-delete-items.sql in Supabase SQL Editor.', 'error')
      }
    }, 8000)

    // Store one timer entry per id so undoDelete can clear them individually or together
    ids.forEach(id => pendingDeleteTimers.current.set(id, timeoutId))

    toast(
      `${count} item${count !== 1 ? 's' : ''} removed`,
      'info',
      { action: { label: 'Undo', onClick: () => undoBulkDelete(ids, timeoutId) }, duration: 8000 }
    )
  }

  function undoBulkDelete(ids, timeoutId) {
    clearTimeout(timeoutId)
    ids.forEach(id => pendingDeleteTimers.current.delete(id))
    setPendingDeleteIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
  }

  // Pending (optimistically hidden) deletions — items removed from view awaiting timer
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set())
  const pendingDeleteTimers = useRef(new Map()) // Map<id, timeoutId>

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    try { const s = localStorage.getItem('inventory-page-size'); return s ? Number(s) : 50 }
    catch { return 50 }
  })
  const [sort, setSort] = useState(() => {
    try {
      const raw = localStorage.getItem('inventory-sort')
      if (!raw) return { col: null, dir: 'asc' }
      const parsed = JSON.parse(raw)
      const col = COLS.some(c => c.key === parsed.col) ? parsed.col : null
      const dir = parsed.dir === 'desc' ? 'desc' : 'asc'
      return { col, dir }
    } catch { return { col: null, dir: 'asc' } }
  })

  function handleSort(col) {
    setSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  // Returns a sortable string value for a given column key
  function getSortValue(item, col) {
    switch (col) {
      case 'brand':    return [item.brand, item.model].filter(Boolean).join(' ').toLowerCase()
      case 'category': return item.category?.toLowerCase() ?? ''
      case 'os':       return item.os?.toLowerCase() ?? ''
      default:         return (item[col] ?? '').toString().toLowerCase()
    }
  }

  const filtered = useMemo(() => {
    if (!items) return []
    const q = search.toLowerCase()
    return items.filter(item => {
      if (pendingDeleteIds.has(item.id)) return false
      if (q) {
        const age = calcDeviceAge(item.purchase_date)
        const isOld = isThreeYearsOrOlder(item.purchase_date)
        const effDue = item.replacement_due || (isOld ? 'Pending' : '')
        const effStatus = (item.replacement_status === 'True' || isOld) ? 'True' : 'False'
        const haystack = [
          item.brand,
          item.model,
          item.serial_number,
          item.assigned_to,
          item.branch,
          item.os,
          item.ram,
          item.ssd,
          item.supplier,
          item.previous_user,
          item.status,
          item.ownership,
          item.invoice_number,
          item.category,
          effDue,
          effStatus,
          age,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filterCategory && item.category !== filterCategory) return false
      if (filterStatus && item.status !== filterStatus) return false
      if (filterBranch && item.branch !== filterBranch) return false
      if (filterReplacementDue === 'Pending') {
        const isOld = isThreeYearsOrOlder(item.purchase_date)
        const effDue = item.replacement_due || (isOld ? 'Pending' : '')
        if (effDue !== 'Pending' && item.replacement_status !== 'True' && !isOld) return false
      }
      return true
    })
  }, [items, pendingDeleteIds, search, filterCategory, filterStatus, filterBranch, filterReplacementDue])

  const hasFilters = search || filterCategory || filterStatus || filterBranch || filterReplacementDue

  const sorted = useMemo(() => {
    if (!sort.col) return filtered
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sort.col)
      const bv = getSortValue(b, sort.col)
      if (av === '' && bv !== '') return 1   // nulls always last
      if (bv === '' && av !== '') return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Reset to page 1 whenever filters or page size change
  useEffect(() => { setPage(1) }, [search, filterCategory, filterStatus, filterBranch, filterReplacementDue, pageSize])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'n' && isAdmin && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openAdd()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist hidden columns
  useEffect(() => {
    try { localStorage.setItem('inventory-hidden-cols', JSON.stringify([...hiddenCols])) } catch {}
  }, [hiddenCols])

  // Persist density
  useEffect(() => {
    try { localStorage.setItem('inventory-density', density) } catch {}
  }, [density])

  // Persist sort
  useEffect(() => {
    try {
      if (sort.col) localStorage.setItem('inventory-sort', JSON.stringify({ col: sort.col, dir: sort.dir }))
      else localStorage.removeItem('inventory-sort')
    } catch {}
  }, [sort])

  // Persist page size
  useEffect(() => {
    try { localStorage.setItem('inventory-page-size', String(pageSize)) } catch {}
  }, [pageSize])

  // Scroll table to top when page changes
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  function openAdd() { setEditingItem(null); setModalOpen(true) }
  function openEdit(item) { setEditingItem(item); setModalOpen(true) }

  function undoDelete(id) {
    const timeoutId = pendingDeleteTimers.current.get(id)
    if (timeoutId != null) {
      clearTimeout(timeoutId)
      pendingDeleteTimers.current.delete(id)
    }
    setPendingDeleteIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleDelete() {
    if (!confirmDelete) return
    const item = confirmDelete
    setConfirmDelete(null)

    // Optimistically hide item
    setPendingDeleteIds(prev => new Set([...prev, item.id]))

    // Schedule actual DB deletion after 8 s (uses delete_items RPC so RLS is bypassed)
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[delete] running scheduled delete for id:', item.id)
        console.log('[delete] calling delete_items RPC with ids:', [item.id])
        const { data, error } = await deleteItemsRpc([item.id])
        console.log('[delete] delete_items response:', { data, error: error ? { message: error.message, code: error.code, details: error.details } : null })
        if (error) throw error
        pendingDeleteTimers.current.delete(item.id)
        await queryClient.invalidateQueries({ queryKey: ['items'] })
        await queryClient.invalidateQueries({ queryKey: ['activity_log'] })
        setPendingDeleteIds(prev => { const n = new Set(prev); n.delete(item.id); return n })
      } catch (err) {
        console.error('[delete] failed:', err?.message, err)
        pendingDeleteTimers.current.delete(item.id)
        setPendingDeleteIds(prev => { const n = new Set(prev); n.delete(item.id); return n })
        queryClient.invalidateQueries({ queryKey: ['items'] })
        toast(err?.message ?? 'Delete failed. Run supabase-rls-allow-delete-items.sql in Supabase SQL Editor.', 'error')
      }
    }, 8000)
    pendingDeleteTimers.current.set(item.id, timeoutId)

    toast(
      `"${item.model || item.brand}" removed`,
      'info',
      { action: { label: 'Undo', onClick: () => undoDelete(item.id) }, duration: 8000 }
    )
  }

  function clearFilters() {
    setSearch('')
    setSearchInput('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterBranch('')
    setFilterReplacementDue('')
  }

  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-5 p-4 sm:p-6 overflow-hidden">
      {/* Page title — visible context for users and screen readers */}
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Inventory</h1>
      </header>

      {/* Header toolbar + count */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400 order-first sm:order-0">
          {isLoading ? 'Loading…' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {/* Columns toggle */}
          <div className="relative" ref={colsMenuRef}>
            <button
              onClick={() => setColsMenuOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Columns
              {hiddenCols.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                  {COLS.length - hiddenCols.size}/{COLS.length}
                </span>
              )}
            </button>
            {colsMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 shadow-lg p-3 min-w-52">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Toggle columns</p>
                <div className="space-y-0.5">
                  {COLS.map(col => (
                    <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                    </label>
                  ))}
                </div>
                {hiddenCols.size > 0 && (
                  <button
                    onClick={() => { setHiddenCols(new Set()); setColsMenuOpen(false) }}
                    className="mt-2 w-full text-xs text-blue-600 dark:text-blue-400 hover:underline text-center py-1"
                  >
                    Show all columns
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Row density */}
          <div className="relative" ref={densityRef}>
            <button
              onClick={() => setDensityMenuOpen(o => !o)}
              title="Row density"
              aria-label="Row density"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${density !== 'default' ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400' : ''}`}
            >
              <AlignJustify className="w-4 h-4" />
              <span className="capitalize hidden sm:inline">{density}</span>
            </button>
            {densityMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 shadow-lg overflow-hidden min-w-36">
                {['compact', 'default', 'comfortable'].map(d => (
                  <button
                    key={d}
                    onClick={() => { setDensity(d); setDensityMenuOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors capitalize ${
                      density === d
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCsv}
            disabled={!sorted.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* View Activity Logs */}
          <button
            onClick={() => setActivityLogOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ScrollText className="w-4 h-4" />
            View Activity Logs
          </button>

          {/* Keyboard shortcuts hint */}
          <button
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
              <Button variant="primary" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search — full width on mobile */}
          <div className="relative w-full sm:flex-1 sm:min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              ref={searchRef}
              placeholder="Search brand, model, serial, assignee, OS…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Filter dropdowns — full width on mobile, then inline */}
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">All categories</option>
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={`${selectClass} w-full sm:w-auto`}>
              <option value="">All branches</option>
              {branchOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full sm:w-auto">
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 animate-[fadeSlideUp_0.15s_ease_forwards]">
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear all filters
          </button>
          {search && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-800">
              <Search className="w-3 h-3 shrink-0" />
              <span className="max-w-40 truncate">{search}</span>
              <button onClick={() => { setSearch(''); setSearchInput('') }} className="ml-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800 p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterCategory && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-200 dark:border-purple-800">
              Category: {filterCategory}
              <button onClick={() => setFilterCategory('')} className="ml-0.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-800 p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterStatus && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800">
              Status: {filterStatus}
              <button onClick={() => setFilterStatus('')} className="ml-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-800 p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterBranch && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
              Branch: {filterBranch}
              <button onClick={() => setFilterBranch('')} className="ml-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800 p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterReplacementDue && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-800">
              Replacement due: {filterReplacementDue}
              <button onClick={() => setFilterReplacementDue('')} className="ml-0.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-800 p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 px-4 py-2.5 bg-blue-600 rounded-xl shadow-md animate-[fadeSlideUp_0.2s_ease_forwards]">
          <span className="text-sm font-semibold text-white">
            {selected.size} item{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setBulkEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-transparent border border-white text-white hover:bg-white/20 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="ml-1 text-white/80 hover:text-white text-xs underline underline-offset-2 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table + Pagination */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
      {isLoading ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <ItemTableSkeleton rowCount={15} />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ItemTable
              items={paginated}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
              sort={sort}
              onSort={handleSort}
              selected={selected}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              hasFilters={!!hasFilters}
              onClearFilters={clearFilters}
              hiddenCols={hiddenCols}
              onRowClick={setDrawerItem}
              scrollRef={tableRef}
              density={density}
              onAddFirstItem={isAdmin ? openAdd : undefined}
            />
          </div>

          {/* Pagination */}
          {sorted.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Row count info */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
                </span>{' '}
                of{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{sorted.length}</span>
              </p>

              <div className="flex items-center gap-3">
                {/* Page size picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Show</span>
                  <select
                    value={pageSize}
                    onChange={e => setPageSize(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={99999}>All</option>
                  </select>
                </div>

                {/* First / Prev / Page X of Y (with input) / Next / Last */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="flex items-center gap-1.5 px-2 text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={safePage}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        if (!Number.isNaN(n) && n >= 1 && n <= totalPages) setPage(n)
                      }}
                      className="w-10 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-center text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Page number"
                    />
                    <span className="font-medium">of {totalPages}</span>
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Item modal */}
      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editingItem}
      />

      {/* CSV import modal */}
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Bulk edit modal */}
      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        onSuccess={() => { setBulkEditOpen(false); clearSelection() }}
        selectedIds={[...selected]}
        categoryOptions={categoryOptions}
        branchOptions={branchOptions}
      />

      {/* Bulk delete confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !bulkDeleteInProgress && setConfirmBulkDelete(false)} />
          <div className="relative bg-zinc-50 dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-300 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">
              Delete {selected.size} item{selected.size !== 1 ? 's' : ''}?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selected.size} selected item{selected.size !== 1 ? 's' : ''} will be removed. You'll have 5 seconds to undo.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleteInProgress}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={bulkDeleteInProgress}
                onClick={() => {
                  setBulkDeleteInProgress(true)
                  setTimeout(() => { handleBulkDelete(); setBulkDeleteInProgress(false) }, 200)
                }}
              >
                {bulkDeleteInProgress ? 'Deleting…' : `Delete ${selected.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleteInProgress && setConfirmDelete(null)} />
          <div className="relative bg-zinc-50 dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-300 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">Delete item?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <strong className="text-gray-700 dark:text-gray-300">
                {confirmDelete.brand} {confirmDelete.model}
              </strong>{' '}
              {confirmDelete.serial_number && `(${confirmDelete.serial_number}) `}
              will be removed.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">You'll have 5 seconds to undo.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleteInProgress}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleteInProgress}
                onClick={() => {
                  setDeleteInProgress(true)
                  setTimeout(() => { handleDelete(); setDeleteInProgress(false) }, 200)
                }}
              >
                {deleteInProgress ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShortcutsOpen(false)} />
          <div className="relative bg-zinc-50 dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-300 dark:border-gray-800 p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Keyboard shortcuts</h2>
              <button onClick={() => setShortcutsOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                ['N',           'Add new item (admin)'],
                ['Ctrl + F',    'Focus search bar'],
                ['↑ / ↓',       'Navigate table rows'],
                ['Enter',       'Open quick-view drawer'],
                ['Escape',      'Close modal / drawer'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{desc}</span>
                  <kbd className="shrink-0 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick-view drawer */}
      <ItemDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />

      {/* Activity log modal */}
      <ActivityLogModal open={activityLogOpen} onClose={() => setActivityLogOpen(false)} />
    </div>
  )
}
