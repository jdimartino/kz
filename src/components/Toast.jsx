// src/components/Toast.jsx
import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'error', duration = 4000) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    const toast = useMemo(() => ({
        error: (msg) => addToast(msg, 'error'),
        success: (msg) => addToast(msg, 'success'),
        warning: (msg) => addToast(msg, 'warning'),
    }), [addToast])

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts }) {
    if (toasts.length === 0) return null

    const styles = {
        error: 'bg-red-500/90 border-red-400/30',
        success: 'bg-green-500/90 border-green-400/30',
        warning: 'bg-amber-500/90 border-amber-400/30 text-black',
    }

    const icons = {
        error: '❌',
        success: '✅',
        warning: '⚠️',
    }

    return (
        <div className="fixed left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
            {toasts.map(t => (
                <div
                    key={t.id}
                    role="alert"
                    className={`pointer-events-auto px-4 py-3 rounded-xl border text-sm font-semibold text-white shadow-2xl flex items-center gap-2 animate-slide-in ${styles[t.type] || styles.error}`}
                >
                    <span>{icons[t.type]}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    )
}

export const useToast = () => useContext(ToastContext)
