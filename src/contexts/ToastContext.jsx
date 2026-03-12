import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: <CheckCircle   className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
  error:   <XCircle       className="w-5 h-5 text-red-500    shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
  info:    <Info          className="w-5 h-5 text-blue-500   shrink-0 mt-0.5" />,
}

const borders = {
  success: 'border-l-emerald-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
}

const barColors = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
}

function ToastItem({ toast: t, onDismiss }) {
  return (
    <div
      className={`relative overflow-hidden flex items-start gap-3.5 px-5 py-4 rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 border-l-[5px] ${borders[t.type]} w-80 animate-[fadeSlideDown_0.25s_cubic-bezier(0.22,1,0.36,1)_forwards]`}
    >
      {icons[t.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{t.message}</p>
        {t.action && (
          <button
            onClick={() => { t.action.onClick(); onDismiss() }}
            className="mt-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Countdown progress bar — only shown when there's an undo action */}
      {t.action && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full origin-left ${barColors[t.type]}`}
            style={{
              animation: `toastCountdown ${t.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'success', options = {}) => {
    const id = Date.now() + Math.random()
    const action = options.action ?? null
    // Success: longer so message is readable; error/undo: caller can override; default shorter for non-success
    const defaultDuration = type === 'success' ? 5000 : 4000
    const duration = options.duration ?? defaultDuration
    setToasts(prev => [...prev, { id, message, type, action, duration }])
    setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed top-5 right-5 z-200 flex flex-col gap-3 pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
