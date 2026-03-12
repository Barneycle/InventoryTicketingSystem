const variants = {
  default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  // item status
  Active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  'In Stock': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  'Under Repair': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  'Lost/Missing': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  Retired: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  Disposed: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
  // replacement status
  True: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  False: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  // replacement due
  Pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  Closed: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  // roles
  admin: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  viewer: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  // activity log
  created: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  updated: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  deleted: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  // ticket status
  Open: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  'In progress': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  'Waiting on user': 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  Resolved: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  Closed: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  // ticket priority
  Low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  Medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  High: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  Critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
}

export default function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.default} ${className}`}
    >
      {children}
    </span>
  )
}
