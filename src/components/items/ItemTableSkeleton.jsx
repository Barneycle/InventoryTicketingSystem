export default function ItemTableSkeleton({ rowCount = 12 }) {
  const colCount = 12 // approximate visible columns
  return (
    <div className="rounded-xl border border-gray-300 dark:border-gray-800 h-full overflow-hidden bg-zinc-50 dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-3 w-10" />
            {[...Array(colCount)].map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </th>
            ))}
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {[...Array(rowCount)].map((_, i) => (
            <tr key={i} className="bg-zinc-50 dark:bg-gray-900">
              <td className="px-3 py-3 w-10">
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </td>
              {[...Array(colCount)].map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div
                    className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    style={{ width: j === 0 ? 120 : j < 3 ? 80 : 60 }}
                  />
                </td>
              ))}
              <td className="px-4 py-3 w-20">
                <div className="flex gap-1">
                  <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
