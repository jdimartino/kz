// src/components/admin/SessionPanel.jsx
import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { DEFAULT_USER } from '../../context/AuthContext'
import { useSession } from '../../context/SessionContext'
import { useSalesReport } from '../../hooks/useSalesReport'
import { closeSession, updateExchangeRate } from '../../services/sessionService'
import { formatUSD } from '../../utils/money'
import { useToast } from '../Toast'

const RATE_ENDPOINTS = [
    'https://ve.dolarapi.com/v1/dolares/oficial',
]

export default function SessionPanel({ onSessionOpen }) {
    const { session, setSession } = useSession()
    const { orders, loading, totalUSD, totalTx } = useSalesReport(session?.id)
    const toast = useToast()
    const [opening, setOpening] = useState(false)
    const [error, setError] = useState('')
    const [closing, setClosing] = useState(false)
    const [confirm, setConfirm] = useState(false)
    const [exchangeRate, setExchangeRate] = useState('')
    const [suggestedRate, setSuggestedRate] = useState(null)
    const [rateLoading, setRateLoading] = useState(false)
    const [editingRate, setEditingRate] = useState(false)
    const [editRateValue, setEditRateValue] = useState('')
    const [editSuggestedRate, setEditSuggestedRate] = useState(null)
    const [editRateLoading, setEditRateLoading] = useState(false)
    const [savingRate, setSavingRate] = useState(false)

    // Sugerir tasa al abrir el panel de apertura
    useEffect(() => {
        if (session?.status === 'open') return
        let cancelled = false
        async function fetchSuggestion() {
            setRateLoading(true)
            for (const url of RATE_ENDPOINTS) {
                try {
                    const res = await fetch(url, { cache: 'no-store' })
                    if (!res.ok) continue
                    const data = await res.json()
                    const value = data.promedio ?? data.rate
                    if (value && !cancelled) {
                        setSuggestedRate(Number(value))
                        setExchangeRate(String(Number(value).toFixed(2)))
                        setRateLoading(false)
                        return
                    }
                } catch { /* try next */ }
            }
            setRateLoading(false)
        }
        fetchSuggestion()
        return () => { cancelled = true }
    }, [session?.status])

    const handleOpen = async (e) => {
        e.preventDefault()
        const rate = parseFloat(exchangeRate)
        if (isNaN(rate) || rate <= 0) {
            setError('Ingresa una tasa de cambio válida')
            return
        }
        setOpening(true)
        try {
            const ref = await addDoc(collection(db, 'sessions'), {
                cashierId: DEFAULT_USER.uid,
                status: 'open',
                openedAt: serverTimestamp(),
                closedAt: null,
                exchangeRate: rate,
                totalSales: 0,
            })
            setSession({ id: ref.id, status: 'open', exchangeRate: rate })
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
            await closeSession(session.id, { totalUSD, totalTx })
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

    const totalUSDSum = orders.reduce((s, o) => s + (o.totalUSD || 0), 0)

    const handleFetchEditSuggestion = async () => {
        setEditRateLoading(true)
        for (const url of RATE_ENDPOINTS) {
            try {
                const res = await fetch(url, { cache: 'no-store' })
                if (!res.ok) continue
                const data = await res.json()
                const value = data.promedio ?? data.rate
                if (value) {
                    setEditSuggestedRate(Number(value))
                    setEditRateValue(String(Number(value).toFixed(2)))
                    setEditRateLoading(false)
                    return
                }
            } catch { /* try next */ }
        }
        setEditRateLoading(false)
    }

    const handleSaveRate = async () => {
        const rate = parseFloat(editRateValue)
        if (isNaN(rate) || rate <= 0) {
            toast.error('Ingresa una tasa válida.')
            return
        }
        setSavingRate(true)
        try {
            await updateExchangeRate(session.id, rate)
            setEditingRate(false)
            setEditSuggestedRate(null)
            toast.success(`Tasa actualizada a Bs ${rate.toFixed(2)}`)
        } catch (err) {
            console.error(err)
            toast.error('Error al actualizar la tasa.')
        } finally {
            setSavingRate(false)
        }
    }

    const byMethod = orders.reduce((acc, o) => {
        const m = o.paymentMethod || 'unknown'
        acc[m] = (acc[m] || 0) + (o.totalUSD || 0)
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
                    <div className="flex-1">
                        <p className="text-green-400 font-bold text-lg">Caja Abierta</p>
                        <p className="text-slate-300 text-sm">Sesión activa — ID: {session.id.slice(0, 8)}</p>
                        {!editingRate ? (
                            <p className="text-blue-400 text-sm font-semibold mt-1">
                                💰 Tasa: Bs {session.exchangeRate?.toFixed(2)}
                                <button
                                    onClick={() => { setEditingRate(true); setEditRateValue(session.exchangeRate?.toFixed(2) || ''); setEditSuggestedRate(null); handleFetchEditSuggestion() }}
                                    className="ml-2 text-[11px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-lg transition-colors"
                                >
                                    ✏️ Cambiar
                                </button>
                            </p>
                        ) : (
                            <div className="mt-2 space-y-2">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Bs</span>
                                    <input
                                        type="number" step="0.01" min="0.01"
                                        value={editRateValue}
                                        onChange={e => setEditRateValue(e.target.value)}
                                        className="input-field pl-9 pr-12 py-2 text-sm"
                                        placeholder={editRateLoading ? 'Consultando...' : '0.00'}
                                        autoFocus
                                    />
                                    {editRateLoading && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {!editRateLoading && editSuggestedRate && (
                                        <button
                                            type="button"
                                            onClick={() => setEditRateValue(String(editSuggestedRate.toFixed(2)))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded-lg transition-colors"
                                            title="Usar tasa sugerida"
                                        >
                                            ⟳ {editSuggestedRate.toFixed(2)}
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingRate(false); setEditSuggestedRate(null) }} className="btn-secondary flex-1 text-xs py-2">Cancelar</button>
                                    <button onClick={handleSaveRate} disabled={savingRate || !editRateValue} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50 text-xs">
                                        {savingRate ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        )}
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
                                <p className="text-blue-400 font-extrabold text-lg">{formatUSD(totalUSDSum)}</p>
                            </div>
                            <div className="bg-[#0F172A] rounded-xl p-3 text-center">
                                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Transacciones</p>
                                <p className="text-white font-extrabold text-lg">{totalTx}</p>
                            </div>
                        </div>

                        {Object.keys(byMethod).length > 0 && (
                            <div className="space-y-1">
                                {Object.entries(byMethod).map(([m, usd]) => (
                                    <div key={m} className="flex justify-between text-xs">
                                        <span className="text-slate-400">{METHOD_LABELS[m] || m}</span>
                                        <span className="text-blue-400 font-bold">{formatUSD(usd)}</span>
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
                                <p className="text-slate-400 text-xs text-center">Se registrará un total de <span className="text-white font-bold">{formatUSD(totalUSDSum)}</span> en {totalTx} transacciones.</p>
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
                    {/* Tasa de cambio */}
                    <div>
                        <label className="label-xs">Tasa de cambio (Bs/USD)</label>
                        <p className="text-slate-500 text-[11px] mb-2">
                            Esta tasa se usará para calcular los montos en bolívares durante toda la sesión.
                        </p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Bs</span>
                            <input
                                type="number" step="0.01" min="0.01"
                                value={exchangeRate}
                                onChange={e => setExchangeRate(e.target.value)}
                                className="input-field pl-10 pr-12"
                                placeholder={rateLoading ? 'Consultando...' : '0.00'}
                                required
                            />
                            {rateLoading && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            {!rateLoading && suggestedRate && (
                                <button
                                    type="button"
                                    onClick={() => setExchangeRate(String(suggestedRate.toFixed(2)))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-2 py-1 rounded-lg transition-colors"
                                    title="Usar tasa sugerida"
                                >
                                    ⟳ {suggestedRate.toFixed(2)}
                                </button>
                            )}
                        </div>
                        {suggestedRate && (
                            <p className="text-slate-500 text-[10px] mt-1">
                                Tasa sugerida: Bs {suggestedRate.toFixed(2)} (puedes modificarla)
                            </p>
                        )}
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <button type="submit" disabled={opening} className="btn-primary w-full">
                        {opening ? 'Abriendo...' : '🏪 Abrir Caja'}
                    </button>
                </form>
            </div>
        </div>
    )
}
