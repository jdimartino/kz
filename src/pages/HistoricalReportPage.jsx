// src/pages/HistoricalReportPage.jsx
// Reporte histórico por período de fechas o por sesión de caja
import { useState } from 'react'
import { useHistoricalReport } from '../hooks/useHistoricalReport'
import { useSessions } from '../hooks/useSessions'
import { formatUSD, formatBs } from '../utils/money'
import { getOrderItems, voidOrder } from '../services/orderService'
import { useCart } from '../context/CartContext'
import { useNav } from '../context/NavigationContext'

function todayStr() {
    const d = new Date()
    return d.toISOString().slice(0, 10)
}

const METHOD_LABELS = {
    bs_cash:    '💴 Efectivo Bs.',
    transfer:   '📲 Pago Móvil',
    pos_term:   '💳 Punto de Venta',
    usd_cash:   '💵 Efectivo USD',
    mixed:      '🔀 Combinado',
    unknown:    '❓ Sin método',
}

export default function HistoricalReportPage() {
    const [dateFrom, setDateFrom] = useState(todayStr())
    const [dateTo, setDateTo] = useState(todayStr())
    const [reportMode, setReportMode] = useState('date')
    const [selectedSessionId, setSelectedSessionId] = useState(null)

    const { sessions } = useSessions()
    const { orders, loading, productTotals } = useHistoricalReport(
        reportMode === 'date' ? { mode: 'date', dateFrom, dateTo } : { mode: 'session', sessionId: selectedSessionId }
    )
    const { dispatch } = useCart()
    const { setScreen } = useNav()

    const [expandedOrderId, setExpandedOrderId] = useState(null)
    const [orderItems, setOrderItems] = useState({})

    const activeOrders = orders.filter(o => !o.voided)
    const voidedOrders = orders.filter(o => o.voided)

    const byMethod = activeOrders.reduce((acc, o) => {
        const m = o.paymentMethod || 'unknown'
        acc[m] = (acc[m] || 0) + (o.totalUSD || 0)
        return acc
    }, {})

    const totalUSDSum = activeOrders.reduce((s, o) => s + (o.totalUSD || 0), 0)

    const handleExpandOrder = async (orderId) => {
        if (expandedOrderId === orderId) { setExpandedOrderId(null); return }
        setExpandedOrderId(orderId)
        if (!orderItems[orderId]) {
            const items = await getOrderItems(orderId)
            setOrderItems(prev => ({ ...prev, [orderId]: items }))
        }
    }

    const handleEditOrder = async (orderId) => {
        if (!window.confirm('¿Estás seguro de editar esta factura? La factura actual será anulada y se creará una nueva.')) return
        await voidOrder(orderId)
        const items = await getOrderItems(orderId)
        dispatch({ type: 'CLEAR_CART' })
        for (const item of items) {
            dispatch({
                type: 'ADD_ITEM',
                payload: {
                    id: item.productId,
                    name: item.name,
                    emoji: item.emoji,
                    priceUSD: item.unitPriceUSD,
                },
            })
            if (item.qty > 1) {
                for (let i = 1; i < item.qty; i++) {
                    dispatch({
                        type: 'ADD_ITEM',
                        payload: {
                            id: item.productId,
                            name: item.name,
                            emoji: item.emoji,
                            priceUSD: item.unitPriceUSD,
                        },
                    })
                }
            }
        }
        setScreen('ticket')
    }

    const handleVoidOrder = async (orderId) => {
        if (!window.confirm('¿Estás seguro de anular esta factura?')) return
        await voidOrder(orderId)
    }

    const handleShareWhatsApp = () => {
        let dateLabel
        if (reportMode === 'session') {
            const session = sessions.find(s => s.id === selectedSessionId)
            dateLabel = session?.openedAt?.seconds
                ? new Date(session.openedAt.seconds * 1000).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'
        } else {
            dateLabel = `${new Date(dateFrom).toLocaleDateString('es-VE')} → ${new Date(dateTo).toLocaleDateString('es-VE')}`
        }

        const methodLines = Object.entries(byMethod)
            .filter(([, cents]) => cents > 0)
            .map(([m, usd]) => `  ${METHOD_LABELS[m] || m} — ${formatUSD(usd)}`)
            .join('\n')

        const orderLines = activeOrders
            .sort((a, b) => (a.invoiceNumber || 0) - (b.invoiceNumber || 0))
            .map((o, idx) => {
                const num = o.invoiceNumber ? `#${String(o.invoiceNumber).padStart(4, '0')}` : `${idx + 1}`
                const time = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''
                return `  ${num} ${time} — ${formatUSD(o.totalUSD || 0)}`
            })
            .join('\n')

        const msg = [
            `🍔 *La KZ — Reporte Histórico*`,
            `📅 ${dateLabel}\n`,
            `*Resumen por Método de Pago:*`,
            methodLines,
            `\n*Detalle de Órdenes:*`,
            orderLines,
            `\n💵 *Total Ventas: ${formatUSD(totalUSDSum)}*`,
        ].join('\n')

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
                <p className="text-slate-400 animate-pulse">Cargando reporte...</p>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">

            {/* Selector de modo de reporte */}
            <div className="flex gap-2 bg-[#1E293B] p-1 rounded-xl border border-white/5" role="tablist">
                <button
                    role="tab"
                    aria-selected={reportMode === 'date'}
                    onClick={() => setReportMode('date')}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${reportMode === 'date' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    Por Fechas
                </button>
                <button
                    role="tab"
                    aria-selected={reportMode === 'session'}
                    onClick={() => setReportMode('session')}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${reportMode === 'session' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    Por Sesión
                </button>
            </div>

            {/* Filtros por fechas */}
            {reportMode === 'date' && (
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="label-xs">Desde</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field mt-1" />
                    </div>
                    <div className="flex-1">
                        <label className="label-xs">Hasta</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field mt-1" />
                    </div>
                </div>
            )}

            {/* Filtro por sesión */}
            {reportMode === 'session' && (
                <select
                    value={selectedSessionId || ''}
                    onChange={e => setSelectedSessionId(e.target.value || null)}
                    className="w-full input-field"
                >
                    <option value="">-- Selecciona una sesión --</option>
                    {sessions
                        .sort((a, b) => (b.openedAt?.seconds || 0) - (a.openedAt?.seconds || 0))
                        .map(s => (
                            <option key={s.id} value={s.id}>
                                🏪 {s.openedAt?.seconds ? new Date(s.openedAt.seconds * 1000).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} {s.status === 'closed' ? '(Cerrada)' : '(Abierta)'}
                            </option>
                        ))}
                </select>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-sm">📋 Reporte Histórico</h2>
                <button
                    onClick={handleShareWhatsApp}
                    className="text-xs font-bold bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20 px-4 py-2.5 rounded-xl transition-all"
                >
                    📤 Compartir por WhatsApp
                </button>
            </div>

            {/* Resumen total */}
            <div className="bg-[#1E293B] rounded-2xl p-5 border border-white/5">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Total Ventas</p>
                <p className="text-blue-400 font-extrabold text-2xl">{formatUSD(totalUSDSum)}</p>
            </div>

            {/* Por método de pago */}
            {Object.keys(byMethod).length > 0 && (
                <div className="bg-[#1E293B] rounded-2xl p-4 border border-white/5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Por Método de Pago</p>
                    <div className="space-y-2">
                        {Object.entries(byMethod).map(([m, usd], i, arr) => (
                            <div key={m} className={`flex items-center justify-between py-1 ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <p className="text-xs text-slate-300">{METHOD_LABELS[m] || m}</p>
                                <p className="text-blue-400 font-bold text-sm">{formatUSD(usd)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top productos */}
            {productTotals && productTotals.length > 0 && (
                <div className="bg-[#1E293B] rounded-2xl p-4 border border-white/5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Top Productos</p>
                    <div className="space-y-1">
                        {productTotals.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-slate-300 truncate max-w-[180px]">
                                    {p.emoji} {p.name} <span className="text-slate-500">x{p.qty}</span>
                                </span>
                                <span className="text-blue-400 font-bold shrink-0 w-20 text-right">{formatUSD(p.totalUSD)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de órdenes */}
            {activeOrders.length === 0 ? (
                <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-slate-500 text-sm">No hay ventas en este período</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {activeOrders.sort((a, b) => (a.invoiceNumber || 0) - (b.invoiceNumber || 0)).map(o => (
                        <div key={o.id} className="bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5">
                            <button
                                onClick={() => handleExpandOrder(o.id)}
                                className="w-full flex items-center justify-between px-4 py-3 gap-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-bold text-slate-500 shrink-0">
                                        {o.invoiceNumber ? `#${String(o.invoiceNumber).padStart(4, '0')}` : '—'}
                                    </span>
                                    <p className="text-xs text-slate-300 truncate">{METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-blue-400 font-bold text-sm">{formatUSD(o.totalUSD || 0)}</p>
                                </div>
                            </button>

                            {expandedOrderId === o.id && (
                                <div className="border-t border-white/5 px-4 py-3 space-y-2">
                                    {(orderItems[o.id] || []).map(item => (
                                        <div key={item.productId} className="flex justify-between text-xs">
                                            <span className="text-slate-300">
                                                {item.emoji} {item.name} <span className="text-slate-500">x{item.qty}</span>
                                            </span>
                                            <div className="text-right">
                                                <p className="text-blue-400 font-bold">{formatUSD(item.subtotalUSD)}</p>
                                                {o.paymentRate && o.totalBsAtPayment && (
                                                    <p className="text-slate-500 text-[10px]">{formatBs(item.subtotalUSD * o.paymentRate)}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {!orderItems[o.id] && (
                                        <p className="text-slate-500 text-xs animate-pulse">Cargando...</p>
                                    )}
                                    <div className="flex gap-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => handleEditOrder(o.id)}
                                            className="text-[11px] font-bold px-3 py-2 rounded-lg bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 transition-colors"
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() => handleVoidOrder(o.id)}
                                            className="text-[11px] font-bold px-3 py-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                                        >
                                            🚫 Anular
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Órdenes anuladas */}
            {voidedOrders.length > 0 && (
                <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/10">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Anuladas ({voidedOrders.length})</p>
                    {voidedOrders.map(o => (
                        <div key={o.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-slate-500">{o.invoiceNumber ? `#${String(o.invoiceNumber).padStart(4, '0')}` : '—'}</span>
                            <span className="text-red-400/60">{formatUSD(o.totalUSD || 0)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
