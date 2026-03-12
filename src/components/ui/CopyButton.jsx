import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({ value, children, className = '' }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Click to copy'}
      className={`inline-flex items-center gap-1 group/copy rounded hover:bg-gray-100 dark:hover:bg-gray-700 px-1 -mx-1 transition-colors ${className}`}
    >
      {children}
      {copied
        ? <Check className="w-3 h-3 text-emerald-500 shrink-0" />
        : <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
      }
    </button>
  )
}
