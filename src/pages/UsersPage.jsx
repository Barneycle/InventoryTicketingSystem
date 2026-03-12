import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfiles } from '../hooks/useProfiles'
import Badge from '../components/ui/Badge'
import CopyButton from '../components/ui/CopyButton'

export default function UsersPage() {
  const { role } = useAuth()
  const { data: profiles = [], isLoading } = useProfiles()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles
    const q = search.toLowerCase()
    return profiles.filter((p) => {
      const name = (p.full_name ?? '').toLowerCase()
      const id = (p.id ?? '').toLowerCase()
      const roleStr = (p.role ?? '').toLowerCase()
      return name.includes(q) || id.includes(q) || roleStr.includes(q)
    })
  }, [profiles, search])

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 overflow-y-auto h-full">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          All users with access to the inventory and ticketing system
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, or ID…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-zinc-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search users"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {search.trim() ? 'No users match your search.' : 'No users found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    User ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 dark:border-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {p.full_name?.trim() || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={p.role === 'admin' ? 'admin' : 'viewer'}>
                        {p.role ?? 'viewer'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      <CopyButton value={p.id}>
                        <span className="truncate max-w-[180px] inline-block" title={p.id}>
                          {p.id}
                        </span>
                      </CopyButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          {search.trim() ? ` matching "${search}"` : ''}
        </p>
      )}
    </div>
  )
}
