import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Box, Ticket,
  ChevronLeft, ChevronRight, LogOut, User, Menu, X,
} from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import Badge from '../ui/Badge'
import { useAuth } from '../../contexts/AuthContext'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
]

function saveCollapsed(val) {
  try { localStorage.setItem('sidebar-collapsed', val ? '1' : '0') } catch {}
}

// ─── Shared inner content ────────────────────────────────────────────────────
function SidebarInner({ collapsed, onExpand, onCollapse, onClose }) {
  const { user, role, signOut } = useAuth()

  return (
    <>
      {/* Logo + collapse toggle */}
      {collapsed ? (
        <div className="flex items-center justify-center py-4 border-b border-gray-300 dark:border-gray-800">
          <button
            onClick={onExpand}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-300 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900 dark:text-gray-50 tracking-tight whitespace-nowrap">
              Inventory
            </span>
          </div>
          {/* Desktop: collapse button  |  Mobile: close button */}
          {onCollapse ? (
            <button
              onClick={onCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              title="Close menu"
              aria-label="Close menu"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: theme + user + sign out */}
      <div className="border-t border-gray-300 dark:border-gray-800 p-2 space-y-1">
        <ThemeToggle collapsed={collapsed} />

        <div
          className={`flex items-center gap-2 px-2 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? (user?.email ?? '') : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{user?.email}</p>
              <Badge variant={role === 'admin' ? 'admin' : 'viewer'} className="mt-0.5">{role}</Badge>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Sidebar() {
  const location = useLocation()

  // Desktop collapsed state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === '1' } catch { return false }
  })

  // Mobile open state
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  function expand()   { setCollapsed(false); saveCollapsed(false) }
  function collapse() { setCollapsed(true);  saveCollapsed(true)  }

  const asideBase = 'flex flex-col bg-zinc-50 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-800 h-full'

  return (
    <>
      {/* ── Mobile: hamburger button ─────────────────────────────────────── */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-zinc-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 shadow-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* ── Mobile: backdrop ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ───────────────────────────────────────── */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-xl ${asideBase} transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarInner collapsed={false} onExpand={null} onCollapse={null} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* ── Desktop: regular sidebar ──────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 ${asideBase} transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarInner
          collapsed={collapsed}
          onExpand={expand}
          onCollapse={collapse}
          onClose={null}
        />
      </aside>
    </>
  )
}
