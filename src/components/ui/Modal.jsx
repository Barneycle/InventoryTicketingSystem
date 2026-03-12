import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  fit: 'w-fit',
}

function getFocusableElements(container) {
  if (!container) return []
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return [...container.querySelectorAll(selector)].filter(el => el.offsetParent !== null)
}

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const containerRef = useRef(null)
  const previousActiveRef = useRef(null)

  // Body scroll lock, Escape, Tab trap — cleanup does NOT restore focus so parent re-renders (new onClose) don’t steal focus from inputs
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'

    function handleKey(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement
      if (e.shiftKey) {
        if (current === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (current === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  // On open: save trigger element and focus first focusable. On close: restore focus to trigger. Only depends on [open] so typing doesn’t re-run.
  useEffect(() => {
    if (!open) return
    previousActiveRef.current = document.activeElement
    const container = containerRef.current
    if (container) {
      const focusable = getFocusableElements(container)
      if (focusable.length > 0) focusable[0].focus()
    }
    return () => {
      if (previousActiveRef.current && typeof previousActiveRef.current.focus === 'function') {
        previousActiveRef.current.focus()
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative ${sizeMap[size] ?? sizeMap.md} bg-zinc-50 dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] outline-none`}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 dark:border-gray-800 shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
