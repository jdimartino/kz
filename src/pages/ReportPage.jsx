// src/pages/ReportPage.jsx
// Reporte del día al cierre de caja
import { useSession } from '../context/SessionContext'
import { useSalesReport } from '../hooks/useSalesReport'
import { formatBs } from '../utils/money'
import { useState } from 'react'
import { getOrderItems, voidOrder } from '../services/orderService'
import { useCart } from '../context/CartContext'
import { useNav } from '../context/NavigationContext'

export default function ReportPage() {
    const { session } = useSession()
    const { orders, loading } = useSalesReport(session?.id)
    const [expandedOrderId, setExpandedOrderId] = useState(null)
    const [orderItems, setOrderItems] = useState({})
    const [expandedMethod, setExpandedMethod] = useState(null)
    const { dispatch } = useCart()
    const { setAdminTab, setScreen } = useNav()

    const activeOrders = orders.filter(o => !o.voided)
    const voidedOrders = orders.filter(o => o.voided)

    const byMethod = activeOrders.reduce((acc, o) => {
        const m = o.paymentMethod || 'unknown'
        acc[m] = (acc[m] || 0) + (o.totalCents || 0)
        return acc
    }, {})

    const totalCentsSum = activeOrders.reduce((s, o) => s + (o.totalCents || 0), 0)

    const handleExpandOrder = async (orderId) => {
        if (expandedOrderId === orderId) { setExpandedOrderId(null); return }
        setExpandedOrderId(orderId)
        if (!orderItems[orderId]) {
            const items = await getOrderItems(orderId)
            setOrderItems(prev => ({ ...prev, [orderId]: items }))
        }
    }

    const handleVoidOrder = async (orderId, invoiceLabel) => {
        if (!window.confirm(`¿Estás seguro de anular la factura ${invoiceLabel}?`)) return
        await voidOrder(orderId)
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
                    priceBS: item.unitPriceCents / 100,
                },
            })
            // Ajustar cantidad si es > 1
            if (item.qty > 1) {
                for (let i = 1; i < item.qty; i++) {
                    dispatch({
                        type: 'ADD_ITEM',
                        payload: {
                            id: item.productId,
                            name: item.name,
                            emoji: item.emoji,
                            priceBS: item.unitPriceCents / 100,
                        },
                    })
                }
            }
        }
        setScreen('ticket')
    }

    const METHOD_LABELS = {
        bs_cash:    '💴 Efectivo Bs.',
        transfer:   '📲 Pago Móvil',
        pos_term:   '💳 Punto de Venta',
        usd_cash:   '💵 Efectivo USD',
        mixed:      '🔀 Combinado',
        unknown:    '❓ Sin método',
    }

    const handleShareWhatsApp = () => {
        const date = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
        const methodLines = Object.entries(byMethod)
            .map(([m, cents]) => `  ${METHOD_LABELS[m] || m} — ${formatBs(cents)}`)
            .join('\n')
        const orderLines = activeOrders
            .map(o => {
                const num = o.invoiceNumber != null ? `#${String(o.invoiceNumber).padStart(4, '0')}` : `#${o.id.slice(0, 6)}`
                const time = o.createdAt?.seconds
                    ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                    : ''
                return `  ${num} ${time} — ${formatBs(o.totalCents || 0)}`
            })
            .join('\n')
        const msg = [
            `🐷 *Los 3 Cochinitos — Reporte del Día*`,
            `📅 ${date}`,
            ``,
            `💵 *Total Ventas: ${formatBs(totalCentsSum)}*`,
            `📊 Transacciones: ${activeOrders.length}`,
            ``,
            `*Desglose por método:*`,
            methodLines,
            ``,
            `*Órdenes:*`,
            orderLines,
        ].join('\n')
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    }

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="space-y-4">

            {/* Banner: caja cerrada */}
            {!session && (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                        <p className="text-amber-400 font-bold text-sm">Caja cerrada</p>
                        <p className="text-slate-400 text-xs mt-0.5">Este reporte muestra las ventas del día.</p>
                    </div>
                    <button
                        onClick={() => { setAdminTab('caja'); setScreen('admin') }}
                        className="text-xs font-bold px-3 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors shrink-0"
                    >
                        Abrir Caja
                    </button>
                </div>
            )}

            {/* Resumen principal */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1E293B] rounded-2xl p-4 text-center border border-white/5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Ventas</p>
                    <p className="text-blue-400 font-extrabold text-2xl">{formatBs(totalCentsSum)}</p>
                </div>
                <div className="bg-[#1E293B] rounded-2xl p-4 text-center border border-white/5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Transacciones</p>
                            <p className="text-white font-extrabold text-2xl">{activeOrders.length}</p>
                            <p className="text-slate-500 text-xs mt-0.5">órdenes pagadas</p>
                        </div>
            </div>

            {/* Desglose por método */}
            {Object.keys(byMethod).length > 0 && (
                <div>
                    <p className="label-xs mb-2">Desglose por Método</p>
                    <div className="bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5">
                        {Object.entries(byMethod).map(([m, cents], i, arr) => {
                            const hasDetail = m === 'mixed'
                            const isExpanded = expandedMethod === m
                            return (
                                <div key={m} className={i < arr.length - 1 ? 'border-b border-white/5' : ''}>
                                    <div
                                        className={`flex justify-between items-center px-4 py-3 ${hasDetail ? 'cursor-pointer' : ''}`}
                                        onClick={() => hasDetail && setExpandedMethod(isExpanded ? null : m)}
                                    >
                                        <p className="text-slate-300 text-sm">{METHOD_LABELS[m] || m}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-blue-400 font-bold text-sm">{formatBs(cents)}</p>
                                            {hasDetail && <span className="text-slate-600 text-xs">{isExpanded ? '▲' : '▼'}</span>}
                                        </div>
                                    </div>
                                    {isExpanded && m === 'mixed' && (
                                        <div className="px-4 pb-3 space-y-1 border-t border-white/5 pt-2">
                                            {(() => {
                                                const breakdownTotals = {}
                                                const labels = { bs_cash: '💴 Efectivo Bs.', transfer: '📲 Pago Móvil', pos_term: '💳 Punto de Venta', usd_cash: '💵 Efectivo USD' }
                                                orders.filter(o => o.paymentMethod === 'mixed').forEach(o => {
                                                    const bd = o.paymentData?.breakdown
                                                    if (bd) {
                                                        bd.forEach(b => { breakdownTotals[b.method] = (breakdownTotals[b.method] || 0) + b.amountBS })
                                                    } else {
                                                        const bs = o.paymentData?.paidBS || 0
                                                        if (bs) breakdownTotals.bs_cash = (breakdownTotals.bs_cash || 0) + bs
                                                    }
                                                })
                                                return Object.entries(breakdownTotals).map(([method, total]) => (
                                                    <div key={method} className="flex justify-between text-xs">
                                                        <span className="text-slate-400">{labels[method] || method}</span>
                                                        <span className="text-slate-300 font-bold">Bs {total.toFixed(2)}</span>
                                                    </div>
                                                ))
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Historial de órdenes */}
            {activeOrders.length > 0 && (
                <div>
                    <p className="label-xs mb-2">Órdenes del Día ({activeOrders.length})</p>
                    <div className="space-y-2">
                        {activeOrders.map((o) => {
                            const invLabel = o.invoiceNumber != null ? `#${String(o.invoiceNumber).padStart(4, '0')}` : `#${o.id.slice(0, 6)}`
                            return (
                                <div key={o.id} className="bg-[#1E293B] rounded-xl border border-white/5 overflow-hidden">
                                    <div
                                        className="px-4 py-2.5 flex items-center justify-between cursor-pointer"
                                        onClick={() => handleExpandOrder(o.id)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-white text-xs font-semibold font-mono">
                                                    {invLabel}
                                                </p>
                                                {o.createdAt?.seconds && (
                                                    <p className="text-slate-500 text-[11px]">
                                                        {new Date(o.createdAt.seconds * 1000).toLocaleString('es-VE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-[11px]">{METHOD_LABELS[o.paymentMethod] || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-blue-400 font-bold text-sm">{formatBs(o.totalCents || 0)}</p>
                                            <span className="text-slate-600 text-xs">{expandedOrderId === o.id ? '▲' : '▼'}</span>
                                        </div>
                                    </div>

                                    {expandedOrderId === o.id && (
                                        <div className="border-t border-white/5 px-4 py-3 space-y-2">
                                            {o.client && (
                                                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                                    <span className="text-slate-400 text-xs">👤 {o.client.name}</span>
                                                    {o.client.phone && <span className="text-slate-500 text-xs">📱 {o.client.phone}</span>}
                                                </div>
                                            )}
                                            {!orderItems[o.id]
                                                ? <p className="text-slate-500 text-xs animate-pulse">Cargando...</p>
                                                : orderItems[o.id].map(item => (
                                                    <div key={item.productId} className="flex justify-between text-xs">
                                                        <span className="text-slate-300">
                                                            {item.emoji} {item.name}
                                                            <span className="text-slate-500 ml-1">x{item.qty}</span>
                                                        </span>
                                                        <span className="text-blue-400 font-bold">{formatBs(item.subtotalCents)}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex gap-2 pt-2 border-t border-white/10">
                                                <button
                                                    onClick={() => handleEditOrder(o.id)}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-2 rounded-xl text-xs transition-all"
                                                >
                                                    📝 Editar
                                                </button>
                                                <button
                                                    onClick={() => handleVoidOrder(o.id, invLabel)}
                                                    className="flex-1 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-2 rounded-xl text-xs transition-all"
                                                >
                                                    ❌ Anular
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {voidedOrders.length > 0 && (
                <div>
                    <p className="label-xs mb-2 text-red-400">❌ Anuladas ({voidedOrders.length})</p>
                    <div className="space-y-2">
                        {voidedOrders.map((o) => {
                            const invLabel = o.invoiceNumber != null ? `#${String(o.invoiceNumber).padStart(4, '0')}` : `#${o.id.slice(0, 6)}`
                            return (
                                <div key={o.id} className="bg-[#1E293B]/50 rounded-xl border border-red-500/20 overflow-hidden opacity-70">
                                    <div
                                        className="px-4 py-2.5 flex items-center justify-between cursor-pointer"
                                        onClick={() => handleExpandOrder(o.id)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-red-400 text-xs font-semibold font-mono line-through">
                                                    {invLabel}
                                                </p>
                                                {o.createdAt?.seconds && (
                                                    <p className="text-slate-500 text-[11px]">
                                                        {new Date(o.createdAt.seconds * 1000).toLocaleString('es-VE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-[11px]">{METHOD_LABELS[o.paymentMethod] || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                                                ANULADA
                                            </span>
                                        </div>
                                    </div>

                                    {expandedOrderId === o.id && (
                                        <div className="border-t border-white/5 px-4 py-3 space-y-2">
                                            {!orderItems[o.id]
                                                ? <p className="text-slate-500 text-xs animate-pulse">Cargando...</p>
                                                : orderItems[o.id].map(item => (
                                                    <div key={item.productId} className="flex justify-between text-xs">
                                                        <span className="text-slate-500 line-through">
                                                            {item.emoji} {item.name}
                                                            <span className="text-slate-600 ml-1">x{item.qty}</span>
                                                        </span>
                                                        <span className="text-slate-600 font-bold">{formatBs(item.subtotalCents)}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {activeOrders.length === 0 && voidedOrders.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-sm">Sin ventas en esta sesión</p>
                </div>
            )}

            {/* Botón compartir WhatsApp */}
            <button
                onClick={handleShareWhatsApp}
                className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
                📲 Compartir por WhatsApp
            </button>
        </div>
    )
}
