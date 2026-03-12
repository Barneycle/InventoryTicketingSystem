import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Label,
} from 'recharts'
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useItems } from '../hooks/useItems'
import { useProfiles } from '../hooks/useProfiles'
import { calcDeviceAge, isThreeYearsOrOlder } from '../components/items/ItemForm'
import Badge from '../components/ui/Badge'

// ─── Colour palette ────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

// ─── Shared tooltip style ──────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    color: '#f9fafb',
  },
  itemStyle: { color: '#f9fafb' },
  cursor: { fill: 'rgba(255,255,255,0.05)' },
}

// ─── Card wrapper ──────────────────────────────────────────────────────────────
function ChartCard({ title, sub, children, delay = 0 }) {
  return (
    <div
      className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 p-5"
      style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${delay}ms` }}
    >
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-3">{sub}</p>}
      {children}
    </div>
  )
}

// ─── Donut centre label ────────────────────────────────────────────────────────
function DonutCentreLabel({ viewBox, total, sub }) {
  const { cx, cy } = viewBox ?? {}
  if (!cx || !cy) return null
  return (
    <g>
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: '1.4rem', fontWeight: 700, fill: '#111827' }}>
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: '0.65rem', fill: '#9ca3af' }}>
        {sub}
      </text>
    </g>
  )
}

// ─── Searchable + sortable table ──────────────────────────────────────────────
const PAGE_SIZE = 15

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-30 shrink-0" />
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />
}

function DataTable({ title, sub, columns, rows, searchKeys, onRowClick }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ col: null, dir: 'asc' })
  const [colOrder, setColOrder] = useState(() => columns.map(c => c.key))
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const orderedCols = colOrder.map(k => columns.find(c => c.key === k)).filter(Boolean)

  function handleSort(key) {
    setSort(prev => ({ col: key, dir: prev.col === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(row =>
      searchKeys.map(k => row[k] ?? '').join(' ').toLowerCase().includes(q)
    )
  }, [rows, search, searchKeys])

  const sorted = useMemo(() => {
    if (!sort.col) return filtered
    return [...filtered].sort((a, b) => {
      const av = (a[sort.col] ?? '').toString().toLowerCase()
      const bv = (b[sort.col] ?? '').toString().toLowerCase()
      if (av === '' && bv !== '') return 1
      if (bv === '' && av !== '') return -1
      // numeric sort for number-like values
      const an = Number(av), bn = Number(bv)
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(v) { setSearch(v); setPage(1) }

  function onDragStart(key) { setDragSrc(key) }
  function onDragEnter(key) { if (key !== dragSrc) setDragOver(key) }
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

  const thBase = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none border-r border-gray-200 dark:border-gray-700 last:border-r-0'
  const tdCls  = 'px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap border-r border-gray-100 dark:border-gray-800 last:border-r-0'

  return (
    <div className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search table"
            className="w-full max-w-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              {orderedCols.map(c => {
                const active   = sort.col === c.key
                const isDragging = dragSrc === c.key
                const isOver   = dragOver === c.key
                return (
                  <th
                    key={c.key}
                    draggable
                    onDragStart={() => onDragStart(c.key)}
                    onDragEnter={() => onDragEnter(c.key)}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={onDragEnd}
                    className={`${thBase} cursor-grab active:cursor-grabbing transition-colors
                      ${active     ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
                      ${isDragging ? 'opacity-40' : ''}
                      ${isOver     ? 'border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <button
                      onClick={() => handleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                    >
                      {c.label}
                      <SortIcon active={active} dir={sort.dir} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={orderedCols.length} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600">
                  No results found.
                </td>
              </tr>
            ) : paged.map((row, i) => (
              <tr
                key={i}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row) } } : undefined}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {orderedCols.map(c => (
                  <td key={c.key} className={tdCls}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 px-1">{safePage}</span>
          {totalPages > 1 && (
            <>
              {[...Array(Math.min(totalPages, 5))].map((_, idx) => {
                const p = idx + 1
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-6 h-6 rounded text-xs transition-colors ${p === safePage ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    {p}
                  </button>
                )
              })}
              {totalPages > 5 && <span className="text-xs text-gray-400 px-1">…{totalPages}</span>}
            </>
          )}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Showing rows {sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
        </p>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, dataUpdatedAt } = useItems()
  const { data: profiles = [] } = useProfiles()
  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles])
  const assigneeLabel = (row) => profileMap[row.assigned_to]?.full_name ?? row.assigned_to ?? '—'
  const lastRefreshed = (dataUpdatedAt ? new Date(dataUpdatedAt) : items ? new Date() : null)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? null

  const charts = useMemo(() => {
    if (!items) return null

    // Device status bar chart
    const statusMap = {}
    const branchEmployees = {}  // branch → Set of assigned_to
    const modelCount = {}

    for (const item of items) {
      const s = item.status ?? 'Unknown'
      statusMap[s] = (statusMap[s] ?? 0) + 1

      if (item.branch && item.assigned_to) {
        if (!branchEmployees[item.branch]) branchEmployees[item.branch] = new Set()
        branchEmployees[item.branch].add(item.assigned_to)
      }

      if (item.model) modelCount[item.model] = (modelCount[item.model] ?? 0) + 1
    }

    const statusData = Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const employeeData = Object.entries(branchEmployees)
      .map(([name, set]) => ({ name, value: set.size }))
      .sort((a, b) => b.value - a.value)
    const totalEmployees = employeeData.reduce((s, d) => s + d.value, 0)

    const sortedModels = Object.entries(modelCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    const top6 = sortedModels.slice(0, 6)
    const otherVal = sortedModels.slice(6).reduce((s, d) => s + d.value, 0)
    const modelData = otherVal > 0 ? [...top6, { name: 'Other', value: otherVal }] : top6
    const totalModels = items.filter(i => i.model).length

    return { statusData, employeeData, totalEmployees, modelData, totalModels }
  }, [items])

  // YTD / replacement queue rows
  // Include items flagged True, Due=Pending, or age >= 3 years. Exclude Closed.
  // Compute effective replacement values for display — DB may have stale/null values
  // for items imported via CSV that haven't been manually saved yet.
  const ytdRows = useMemo(() => {
    if (!items) return []
    return items
      .filter(i =>
        i.replacement_status === 'True' ||
        i.replacement_due === 'Pending' ||
        isThreeYearsOrOlder(i.purchase_date)
      )
      .filter(i => i.replacement_due !== 'Closed')
      .map(i => {
        const isOld = isThreeYearsOrOlder(i.purchase_date)
        const eff_status = (i.replacement_status === 'True' || isOld) ? 'True' : 'False'
        const eff_due    = i.replacement_due || (isOld ? 'Pending' : '')
        return { ...i, _age: calcDeviceAge(i.purchase_date), _eff_status: eff_status, _eff_due: eff_due }
      })
      .sort((a, b) => (a.assigned_to ?? '').localeCompare(b.assigned_to ?? ''))
  }, [items])

  // Allocation rows — include per-assignee laptop count
  const allocRows = useMemo(() => {
    if (!items) return []
    const countByAssignee = {}
    for (const i of items) {
      if (i.assigned_to) countByAssignee[i.assigned_to] = (countByAssignee[i.assigned_to] ?? 0) + 1
    }
    return [...items]
      .filter(i => i.assigned_to)
      .map(i => ({ ...i, laptop_count: countByAssignee[i.assigned_to] ?? 1 }))
      .sort((a, b) => (a.assigned_to ?? '').localeCompare(b.assigned_to ?? ''))
  }, [items])

  if (isLoading) {
    return (
      <div className="space-y-5 p-4 sm:p-6 overflow-y-auto h-full">
        <header className="shrink-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h1>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 p-5">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
              <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse m-4 mb-0" />
            <div className="h-3 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-4 mt-2 mb-4" />
            <div className="space-y-3 px-4 pb-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse m-4 mb-0" />
            <div className="h-3 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-4 mt-2 mb-4" />
            <div className="space-y-3 px-4 pb-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tickColor = '#6b7280'

  return (
    <div className="space-y-5 p-4 sm:p-6 overflow-y-auto h-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Overview of device status, employees, and models</p>
      </header>
      {lastRefreshed && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium" aria-live="polite">
            Data as of {lastRefreshed}
          </p>
        </div>
      )}

      {/* ── Chart row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Device Status */}
        <ChartCard title="Device Status" sub="Current Status of Device (click a bar to filter in Inventory)" delay={0}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={charts?.statusData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar
                dataKey="value"
                name="Count"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
                animationEasing="ease-out"
                onClick={(entry) => {
                  const name = entry?.payload?.name
                  if (name) navigate(`/inventory?status=${encodeURIComponent(name)}`)
                }}
                style={{ cursor: 'pointer' }}
              >
                {charts?.statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Employees by Branch */}
        <ChartCard title="Employees" sub="Total Count of Employees" delay={100}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts?.employeeData}
                cx="50%"
                cy="40%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                animationBegin={120}
                animationDuration={750}
                animationEasing="ease-out"
              >
                {charts?.employeeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <Label
                  content={props => <DonutCentreLabel {...props} total={charts?.totalEmployees} sub="Total value" />}
                  position="center"
                />
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '0.7rem', paddingTop: '6px' }}
                formatter={v => <span style={{ color: tickColor }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Laptop Models */}
        <ChartCard title="Laptop Models" sub="Most commonly used models" delay={200}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={charts?.modelData}
                cx="50%"
                cy="38%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                animationBegin={240}
                animationDuration={750}
                animationEasing="ease-out"
              >
                {charts?.modelData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <Label
                  content={props => <DonutCentreLabel {...props} total={charts?.totalModels} sub="Total value" />}
                  position="center"
                />
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '0.7rem', paddingTop: '6px' }}
                formatter={v => <span style={{ color: tickColor }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── YTD / Replacement queue ────────────────────────── */}
      <div style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '300ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          <Link
            to="/inventory?replacement_due=Pending"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {ytdRows.length} pending replacement
          </Link>
          {' — view in Inventory'}
        </span>
      </div>
      <DataTable
        title="Laptops YTD"
        sub="Items flagged for replacement (click a row to open in Inventory)"
        searchKeys={['serial_number', 'model', 'assigned_to', 'branch']}
        rows={ytdRows}
        onRowClick={(row) => {
          const params = new URLSearchParams({ replacement_due: 'Pending' })
          if (row.branch) params.set('branch', row.branch)
          if (row.assigned_to) params.set('q', row.assigned_to)
          navigate(`/inventory?${params.toString()}`)
        }}
        columns={[
          { key: 'serial_number', label: 'Serial #' },
          { key: 'model',         label: 'Model' },
          { key: '_age',          label: 'YTD', render: r => r._age ?? '—' },
          { key: '_eff_due',    label: 'Replacement Due',    render: r => r._eff_due ? <Badge variant={r._eff_due}>{r._eff_due}</Badge> : '—' },
          { key: '_eff_status', label: 'Replacement Status', render: r => <Badge variant={r._eff_status}>{r._eff_status}</Badge> },
          { key: 'branch',        label: 'Branch' },
          { key: 'assigned_to',   label: 'Assigned To', render: r => assigneeLabel(r) },
        ]}
      />

      </div>

      {/* ── Laptop Allocation ──────────────────────────────── */}
      <div style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '400ms' }}>
      <DataTable
        title="Laptop Allocation"
        sub="The Count of Laptops Allocated to Employees (click a row to open in Inventory)"
        searchKeys={['assigned_to', 'model', 'branch', 'serial_number']}
        rows={allocRows}
        onRowClick={(row) => {
          if (row.assigned_to) navigate(`/inventory?q=${encodeURIComponent(row.assigned_to)}`)
        }}
        columns={[
          { key: 'assigned_to',  label: 'Assigned To', render: r => assigneeLabel(r) },
          { key: 'model',        label: 'Model' },
          { key: 'laptop_count', label: 'Laptop Count', render: r => (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              {r.laptop_count}
            </span>
          )},
        ]}
      />
      </div>

    </div>
  )
}
