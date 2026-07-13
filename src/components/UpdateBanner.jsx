// src/components/UpdateBanner.jsx
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW registrado:', r)
        },
        onRegisterError(error) {
            console.error('Error registrando SW:', error)
        },
    })

    if (!needRefresh) return null

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-[#1E293B] border border-blue-500/20 rounded-2xl p-4 shadow-2xl shadow-black/50 animate-slide-up">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-white text-sm font-bold">Nueva versión disponible</p>
                    <p className="text-slate-400 text-xs mt-0.5">Actualiza para ver los últimos cambios</p>
                </div>
                <button
                    onClick={() => updateServiceWorker(true)}
                    className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 shrink-0"
                >
                    Actualizar
                </button>
            </div>
        </div>
    )
}
