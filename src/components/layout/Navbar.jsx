import { useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import { useAuth } from '../../contexts/AuthContext'
import Badge from '../ui/Badge'

const titles = {
  '/dashboard': 'Dashboard',
  '/inventory': 'Inventory',
  '/reports': 'Reports',
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, role, signOut } = useAuth()

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">
        {titles[pathname] ?? 'Inventory'}
      </h1>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-800 ml-1">
          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="hidden sm:flex flex-col min-w-0">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-36">
              {user?.email}
            </span>
            <Badge variant={role === 'admin' ? 'admin' : 'viewer'} className="mt-0.5 self-start">
              {role}
            </Badge>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="p-1.5 ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
