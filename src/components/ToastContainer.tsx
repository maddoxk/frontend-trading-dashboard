import type { ToastNotification } from '../lib/alerts'

interface ToastContainerProps {
  toasts: ToastNotification[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card toast-${t.type}`}>
          <div className="toast-content">
            <span className="toast-title">{t.title}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
