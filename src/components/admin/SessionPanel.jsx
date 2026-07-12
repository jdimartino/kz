// src/components/admin/SessionPanel.jsx
import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { DEFAULT_USER } from '../../context/AuthContext'
import { useSession } from '../../context/SessionContext'
import { useSalesReport } from '../../hooks/useSalesReport'
import { closeSession } from '../../services/sessionService'
import { formatBs } from '../../utils/money'
import { useToast } from '../Toast'

export default function SessionPanel({ onSessionOpen }) {
    const { session, setSession } = useSession()
    const { orders, loading, totalCents, totalTx } = useSalesReport(session?.id)
    const toast = useToast()
    const [opening, setOpening] = useState(false)
    const [error, setError] = useState('')
    const [closing, setClosing] = useState(false)
    const [confirm, setConfirm] = useState(false)

    const handleOpen = async (e) => {
        e.preventDefault()
        setOpening(true)
        try {
            const ref = await addDoc(collection(db, 'sessions'), {
                cashierId: DEFAULT_USER.uid,
                status: 'open',
                openedAt: serverTimestamp(),
                closedAt: null,
                totalSales: 0,
            })
            setSession({ id: ref.id, status: 'open' })
            onSessionOpen?.()
        } catch (err) {
            setError('Error abriendo caja. Intenta de nuevo.')
            console.error(err)
        } finally {
            setOpening(false)
        }
    }

    const handleClose = async () => {
        setClosing(true)
        try {
            await closeSession(session.id, { totalBs: totalCents / 100, totalTx })
            setSession(null)
            toast.success('Caja cerrada correctamente')
        } catch (err) {
            console.error(err)
            toast.error('Error cerrando caja. Intenta de nuevo.')
        } finally {
            setClosing(false)
            setConfirm(false)
        }
    }

    const totalCentsSum = orders.reduce((s, o) => s + (o.totalCents || 0), 0)

    const byMethod = orders.reduce((acc, o) => {
        const m = o.paymentMethod || 'unknown'
        acc[m] = (acc[m] || 0) + (o.totalCents || 0)
        return acc
    }, {})

    const METHOD_LABELS = {
        bs_cash:    '💴 Efectivo Bs.',
        transfer:   '📲 Pago Móvil',
        pos_term:   '💳 Punto de Venta',
        usd_cash:   '💵 Efectivo USD',
        mixed:      '🔀 Combinado',
        unknown:    '❓ Sin método',
    }

    if (session?.status === 'open') {
        return (
            <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="text-3xl">✅</div>
                    <div>
                        <p className="text-green-400 font-bold text-lg">Caja Abierta</p>
                        <p className="text-slate-300 text-sm">Sesión activa — ID: {session.id.slice(0, 8)}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-[#1E293B] rounded-2xl p-4 space-y-3 border border-white/5">
                        <p className="text-white font-bold text-sm">📊 Reporte del Día</p>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#0F172A] rounded-xl p-3 text-center">
                                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Total Ventas</p>
                                <p className="text-blue-400 font-extrabold text-lg">{formatBs(totalCentsSum)}</p>
                            </div>
                            <div className="bg-[#0F172A] rounded-xl p-3 text-center">
                                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Transacciones</p>
                                <p className="text-white font-extrabold text-lg">{totalTx}</p>
                            </div>
                        </div>

                        {Object.keys(byMethod).length > 0 && (
                            <div className="space-y-1">
                                {Object.entries(byMethod).map(([m, cents]) => (
                                    <div key={m} className="flex justify-between text-xs">
                                        <span className="text-slate-400">{METHOD_LABELS[m] || m}</span>
                                        <span className="text-blue-400 font-bold">{formatBs(cents)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!confirm ? (
                            <button onClick={() => setConfirm(true)} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors mt-1 text-sm">
                                🏁 Cerrar Caja
                            </button>
                        ) : (
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-3" role="dialog" aria-label="Confirmar cierre de caja">
                                <p className="text-orange-400 font-bold text-center text-sm">¿Confirmar cierre de caja?</p>
                                <p className="text-slate-400 text-xs text-center">Se registrará un total de <span className="text-white font-bold">{formatBs(totalCentsSum)}</span> en {totalTx} transacciones.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setConfirm(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                                    <button
                                        onClick={handleClose}
                                        disabled={closing}
                                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
                                    >
                                        {closing ? 'Cerrando...' : 'Confirmar Cierre'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="bg-[#1E293B] rounded-2xl p-5">
                <h3 className="text-white font-bold text-lg mb-1">🏪 Apertura de Caja</h3>
                <p className="text-slate-400 text-sm mb-5">
                    Inicia la sesión del día para comenzar a facturar.
                </p>
                <form onSubmit={handleOpen} className="space-y-4">
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <button type="submit" disabled={opening} className="btn-primary w-full">
                        {opening ? 'Abriendo...' : '🏪 Abrir Caja'}
                    </button>
                </form>
            </div>
        </div>
    )
}
