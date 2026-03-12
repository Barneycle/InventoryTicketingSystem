import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-zinc-200 dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Spacer for mobile hamburger — h-14 gives room so first content isn’t cramped under the fixed button */}
        <div className="md:hidden shrink-0 min-h-14 h-14 bg-zinc-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-800" aria-hidden />
        {/* Extra top padding on mobile so primary actions (search, Add) clear the bar and are easy to tap */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-1 md:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
