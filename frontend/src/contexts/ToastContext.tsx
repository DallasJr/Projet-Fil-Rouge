import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { CheckCircle, Info, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'info' | 'error'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {}
})

export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' && <CheckCircle size={16} />}
              {toast.type === 'info' && <Info size={16} />}
              {toast.type === 'error' && <AlertCircle size={16} />}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Hook utilitaire pour écouter les événements socket et afficher des toasts de statut
export const useOrderStatusToasts = (socket: any, addToast: (msg: string, type?: ToastType) => void) => {
  useEffect(() => {
    if (!socket) return

    const handleStatusUpdate = (data: { orderId: string; status: string }) => {
      const messages: Record<string, string> = {
        ACCEPTED:   '✅ Votre commande a été acceptée !',
        PREPARING:  '👨‍🍳 Votre commande est en préparation...',
        READY:      '📦 Votre commande est prête !',
        DELIVERING: '🚚 Un livreur prend en charge votre livraison !',
        DELIVERED:  '🎉 Votre commande a été livrée !',
        PICKED_UP:  '📦 Le livreur a récupéré la commande.',
        CANCELLED:  '❌ Votre commande a été annulée.'
      }
      const msg = messages[data.status]
      if (msg) addToast(msg, data.status === 'CANCELLED' ? 'error' : data.status === 'DELIVERED' ? 'success' : 'info')
    }

    socket.on('order_status_updated', handleStatusUpdate)
    return () => socket.off('order_status_updated', handleStatusUpdate)
  }, [socket, addToast])
}
