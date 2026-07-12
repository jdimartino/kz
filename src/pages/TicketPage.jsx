// src/pages/TicketPage.jsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useCart } from '../context/CartContext'
import { useSession } from '../context/SessionContext'
import { DEFAULT_USER } from '../context/AuthContext'
import { useNav } from '../context/NavigationContext'
import { saveOrder, nextInvoiceNumber, completeHoldOrder } from '../services/orderService'
import { formatUSD, formatBs, usdToBs, bsToUsd, calcChange } from '../utils/money'
import { updateCustomerStats } from '../services/customerService'
import { useToast } from '../components/Toast'

const METHODS = [
    { id: 'bs_cash', label: 'Efectivo Bs.', icon: '💴' },
    { id: 'transfer', label: 'Pago Móvil', icon: '📲' },
    { id: 'pos_term', label: 'Punto de Venta', icon: '💳' },
    { id: 'usd_cash', label: 'Efectivo USD', icon: '💵' },
    { id: 'mixed', label: 'Combinado', icon: '🔀' },
]

const MIXED_OPTIONS = [
    { id: 'bs_cash', label: 'Efectivo Bs.', icon: '💴' },
    { id: 'transfer', label: 'Pago Móvil', icon: '📲' },
    { id: 'pos_term', label: 'Punto de Venta', icon: '💳' },
    { id: 'usd_cash', label: 'Efectivo USD', icon: '💵' },
]

export default function TicketPage() {
    const { items, totalUSD, dispatch } = useCart()
    const { session } = useSession()
    const { setScreen, setOrderId, setLastOrderData, holdOrderId, setHoldOrderId, selectedClient, setSelectedClient } = useNav()
    const toast = useToast()
    const rate = session?.exchangeRate || null

    const [method, setMethod] = useState('transfer')
    const [paidBS, setPaidBS] = useState('')
    const [saving, setSaving] = useState(false)
    const [invoiceNum, setInvoiceNum] = useState(null)
    const [reference, setReference] = useState('')
    const [mixedPayments, setMixedPayments] = useState([])

    useEffect(() => {
        nextInvoiceNumber().then(setInvoiceNum).catch(() => {})
    }, [])

    useEffect(() => {
        if (method !== 'mixed') {
            setMixedPayments([])
        }
    }, [method])

    const totalBs = rate ? usdToBs(totalUSD, rate) : 0

    const mixedRemaining = useMemo(() => {
        if (method !== 'mixed') return null
        const totalPaid = mixedPayments.reduce((s, p) => {
            const amount = parseFloat(p.amount) || 0
            const inBs = p.method === 'usd_cash' ? usdToBs(amount, rate) : amount
            return s + inBs
        }, 0)
        const diff = totalBs - totalPaid
        const covered = diff < 0.005
        return {
            remainingBs: Math.max(0, diff),
            remainingUSD: diff > 0 ? bsToUsd(diff, rate) : 0,
            overpaidBs: Math.max(0, -diff),
            overpaidUSD: diff < 0 ? bsToUsd(-diff, rate) : 0,
            covered,
            totalPaid,
        }
    }, [method, mixedPayments, totalBs, rate])

    const change = useMemo(() => {
        if (method === 'bs_cash') {
            if (!paidBS) return null
            const ch = calcChange(parseFloat(paidBS) || 0, totalBs)
            return ch > 0 ? { label: 'Vuelto', value: formatBs(ch) } : null
        }
        if (method === 'usd_cash') {
            if (!paidBS) return null
            const paidUSD = parseFloat(paidBS) || 0
            const changeUSD = Math.max(0, paidUSD - totalUSD)
            if (changeUSD <= 0) return null
            return {
                label: 'Vuelto',
                valueUSD: formatUSD(changeUSD),
                valueBs: formatBs(usdToBs(changeUSD, rate)),
            }
        }
        return null
    }, [method, paidBS, totalBs])

    const canPay = useCallback(() => {
        if (!session?.id) return false
        if (!rate) return false
        if (method === 'bs_cash') return true
        if (method === 'usd_cash') return parseFloat(paidBS) >= totalUSD
        if (method === 'pos_term') return true
        if (method === 'transfer') return true
        if (method === 'mixed') return !!mixedRemaining?.covered
        return false
    }, [session?.id, method, paidBS, totalBs, mixedRemaining, rate])

    const handlePay = async () => {
        if (!canPay()) return
        if (!session?.id) {
            toast.error('No hay caja abierta. Abre la caja del día primero.')
            return
        }
        setSaving(true)
        try {
            const payment = {
                method,
                totalUSD,
                totalBsAtPayment: totalBs,
                paymentRate: rate,
                ...(method === 'bs_cash' && {
                    paidBS: parseFloat(paidBS) || totalBs,
                    changeBS: paidBS ? parseFloat(paidBS) - totalBs : 0,
                }),
                ...(method === 'usd_cash' && { paidBS: parseFloat(paidBS), changeBS: parseFloat(paidBS) - totalBs }),
                ...(method === 'pos_term' && { paidPOS: totalBs }),
                ...(method === 'transfer' && { reference }),
                ...(method === 'mixed' && {
                    breakdown: mixedPayments.map(p => ({
                        method: p.method,
                        amountBS: parseFloat(p.amount) || 0,
                    })),
                }),
            }
            const customerId = selectedClient?.id?.length > 20 ? selectedClient.id : null
            const orderId = await saveOrder({
                cashierId: DEFAULT_USER.uid,
                sessionId: session.id,
                items,
                payment,
                invoiceNumber: invoiceNum,
                customerId,
            })
            if (customerId) {
                await updateCustomerStats(customerId, { totalUSD }).catch(() => {})
            }
            setOrderId(orderId)
            setLastOrderData({
                items: [...items],
                totalUSD,
                payment: { ...payment },
                invoiceNumber: invoiceNum,
            })
            dispatch({ type: 'CLEAR_CART' })
            setSelectedClient(null)
            if (holdOrderId) {
                await completeHoldOrder(holdOrderId)
                setHoldOrderId(null)
            }
            setScreen('success')
        } catch (err) {
            console.error(err)
            toast.error('Error al procesar el pago. Intenta de nuevo.')
        } finally {
            setSaving(false)
        }
    }

    const noSession = !session?.id

    return (
        <div className="min-h-screen bg-[#0F172A] flex flex-col pb-32">

            {/* Header */}
            <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button
                    onClick={() => { setHoldOrderId(null); setScreen('pos') }}
                    aria-label="Volver al POS"
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all"
                >
                    ← Atrás
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm leading-none">Ticket de Cobro</p>
                        {invoiceNum != null
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                #{String(invoiceNum).padStart(4, '0')}
                              </span>
                            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 border border-white/10 animate-pulse">
                                #----
                              </span>
                        }
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                        {items.length} producto{items.length !== 1 ? 's' : ''}
                        {rate && <span className="text-slate-400 ml-2">Tasa: Bs {rate.toFixed(2)}</span>}
                    </p>
                </div>
                <div className="ml-auto text-right">
                    <p className="text-blue-400 font-extrabold text-lg leading-none">{formatUSD(totalUSD)}</p>
                    {totalBs > 0 && (
                        <p className="text-slate-300 font-bold text-sm">{formatBs(totalBs)}</p>
                    )}
                </div>
            </header>

            <div className="flex-1 px-4 pt-4 space-y-4">

                {/* Alerta: sin sesión activa */}
                {noSession && (
                    <div role="alert" className="bg-orange-500/15 border border-orange-500/30 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <p className="text-orange-400 font-bold text-sm">Sin sesión de caja</p>
                            <p className="text-slate-400 text-xs mt-0.5">Abre la caja del día antes de cobrar. Hasta entonces el botón estará bloqueado.</p>
                        </div>
                    </div>
                )}

                {/* Lista de ítems */}
                <div className="bg-[#1E293B] rounded-2xl overflow-hidden">
                    {items.map((item, i) => (
                        <div key={item.productId} className={`flex items-center gap-3 px-4 py-2 ${i < items.length - 1 ? 'border-b border-white/5' : ''}`}>
                            <span className="text-base">{item.emoji}</span>
                            <div className="flex-1">
                                <p className="text-white text-xs font-semibold">{item.name}</p>
                                <p className="text-slate-500 text-[11px]">{item.qty} × {formatUSD(item.unitPriceUSD)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-blue-400 font-bold text-xs">{formatUSD(item.subtotalUSD)}</p>
                                {rate && <p className="text-slate-500 text-[10px]">{formatBs(item.subtotalUSD * rate)}</p>}
                            </div>
                        </div>
                    ))}
                    {/* Total */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                        <p className="text-white font-bold">Total</p>
                        <div className="text-right">
                            <p className="text-blue-400 font-extrabold">{formatUSD(totalUSD)}</p>
                            {totalBs > 0 && (
                                <p className="text-slate-500 text-[10px]">{formatBs(totalBs)}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Métodos de pago */}
                <fieldset>
                    <legend className="label-xs mb-2">Método de Pago</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {METHODS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMethod(m.id)}
                                aria-pressed={method === m.id}
                                className={`flex items-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all ${method === m.id
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                                    : 'bg-[#1E293B] border-white/5 text-slate-300 hover:border-blue-500/30'
                                    }`}
                            >
                                <span className="text-lg">{m.icon}</span> {m.label}
                            </button>
                        ))}
                    </div>
                </fieldset>

                {/* Input: Efectivo Bs. */}
                {method === 'bs_cash' && (
                    <div>
                        <label htmlFor="paid-bs" className="label-xs">Monto recibido (Bs.)</label>
                        <p className="text-slate-500 text-[11px] mb-2">Opcional — dejar vacío para pago exacto</p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Bs</span>
                            <input
                                id="paid-bs"
                                type="number" step="0.01"
                                value={paidBS}
                                onChange={e => setPaidBS(e.target.value)}
                                className="input-field pl-10"
                                placeholder={totalBs.toFixed(2)}
                            />
                        </div>
                    </div>
                )}

                {/* Input: Efectivo USD — ahora automático con tasa */}
                {method === 'usd_cash' && (
                    <div>
                        <label htmlFor="paid-usd" className="label-xs">Cantidad en USD recibida</label>
                        <p className="text-slate-500 text-[11px] mb-2">
                            La conversión a Bs se calcula automáticamente con la tasa BCV actual.
                        </p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                            <input
                                id="paid-usd"
                                type="number" step="0.01" min={totalUSD}
                                value={paidBS}
                                onChange={e => setPaidBS(e.target.value)}
                                className="input-field pl-10"
                                placeholder={totalUSD.toFixed(2)}
                            />
                        </div>
                        {paidBS && rate && (
                            <p className="text-slate-500 text-[11px] mt-1">
                                Equivalente: {formatBs(usdToBs(parseFloat(paidBS) || 0, rate))}
                            </p>
                        )}
                    </div>
                )}

                {/* Combinado: cualquier método */}
                {method === 'mixed' && (
                    <div className="bg-[#1E293B] rounded-2xl p-4 space-y-3 border border-white/5">
                        <p className="text-white font-bold text-sm">Métodos combinados</p>

                        {/* Lista de métodos agregados */}
                        {mixedPayments.length === 0 && (
                            <p className="text-slate-500 text-xs text-center py-3">Agrega métodos de pago para combinar</p>
                        )}
                        {mixedPayments.map((mp, idx) => {
                            const opt = MIXED_OPTIONS.find(o => o.id === mp.method)
                            return (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-lg shrink-0">{opt?.icon || '💳'}</span>
                                    <span className="text-xs text-slate-300 font-semibold w-24 shrink-0">{opt?.label || mp.method}</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{mp.method === 'usd_cash' ? '$' : 'Bs'}</span>
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={mp.amount}
                                            onChange={e => {
                                                const next = [...mixedPayments]
                                                next[idx] = { ...next[idx], amount: e.target.value }
                                                setMixedPayments(next)
                                            }}
                                            className="w-full bg-[#0F172A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="0,00"
                                        />
                                        {mp.method === 'usd_cash' && mp.amount && rate && (
                                            <p className="text-slate-500 text-[10px] mt-1 text-right">
                                                = {formatBs(usdToBs(parseFloat(mp.amount) || 0, rate))}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setMixedPayments(mixedPayments.filter((_, i) => i !== idx))}
                                        className="shrink-0 w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-bold"
                                        aria-label={`Quitar ${opt?.label}`}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )
                        })}

                        {/* Botones para agregar métodos disponibles */}
                        {MIXED_OPTIONS.length > mixedPayments.length && (
                            <div className="flex flex-wrap gap-1.5">
                                {MIXED_OPTIONS.filter(o => !mixedPayments.find(mp => mp.method === o.id)).map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setMixedPayments([...mixedPayments, { method: opt.id, amount: '' }])}
                                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 border border-blue-500/20 transition-colors"
                                    >
                                        + {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Total cubierto / restante / vuelto */}
                        {mixedRemaining && mixedPayments.length > 0 && (
                            <div className={`rounded-xl px-4 py-3 flex justify-between items-center border ${
                                mixedRemaining.covered
                                    ? 'bg-green-500/10 border-green-500/20'
                                    : 'bg-amber-500/10 border-amber-500/20'
                            }`}>
                                <div>
                                    <p className={`font-bold text-sm ${mixedRemaining.covered ? 'text-green-400' : 'text-amber-400'}`}>
                                        {mixedRemaining.covered ? '✅ Vuelto' : 'Restante'}
                                    </p>
                                    {!mixedRemaining.covered && (
                                        <p className="text-slate-500 text-[10px] mt-0.5">Cubierto: {formatBs(mixedRemaining.totalPaid)}</p>
                                    )}
                                    {mixedRemaining.covered && mixedRemaining.overpaidBs > 0 && (
                                        <p className="text-slate-500 text-[10px] mt-0.5">Pagado: {formatBs(mixedRemaining.totalPaid)}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    {!mixedRemaining.covered ? (
                                        <>
                                            <p className="text-amber-400 font-extrabold">{formatUSD(mixedRemaining.remainingUSD)}</p>
                                            <p className="text-amber-400/70 text-xs">{formatBs(mixedRemaining.remainingBs)}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-green-400 font-extrabold">{formatUSD(mixedRemaining.overpaidUSD)}</p>
                                            <p className="text-green-400/70 text-xs">{formatBs(mixedRemaining.overpaidBs)}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Vuelto */}
                {change && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 flex justify-between items-center">
                        <p className="text-green-400 font-bold text-sm">{change.label}</p>
                        <div className="text-right">
                            {change.valueUSD && <p className="text-green-400 font-extrabold text-lg">{change.valueUSD}</p>}
                            {change.valueBs && <p className="text-green-400/70 text-xs">{change.valueBs}</p>}
                            {change.value && !change.valueUSD && <p className="text-green-400 font-extrabold text-lg">{change.value}</p>}
                        </div>
                    </div>
                )}

                {/* Transferencia: referencia */}
                {method === 'transfer' && (
                    <div>
                        <label htmlFor="pm-ref" className="label-xs">Número de operación</label>
                        <input
                            id="pm-ref"
                            type="text"
                            inputMode="numeric"
                            maxLength={8}
                            value={reference}
                            onChange={e => setReference(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            className="input-field"
                            placeholder="12345678"
                        />
                    </div>
                )}
            </div>

            {/* Botón Regresar (abajo) */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => { setHoldOrderId(null); setScreen('pos') }}
                    aria-label="Volver al POS"
                    className="w-full bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-4 px-6 rounded-2xl transition-all text-base"
                >
                    ← Regresar
                </button>
            </div>

            {/* Botón Cobrar */}
            <div className="fixed bottom-0 left-0 right-0 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                <button
                    onClick={handlePay}
                    disabled={!canPay() || saving}
                    className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-2xl shadow-green-600/30 disabled:opacity-40 disabled:pointer-events-none text-lg"
                >
                    {saving ? 'Procesando...' : <><span>✅ Cobrar {formatUSD(totalUSD)}</span><br /><span className="text-lg opacity-80">{formatBs(totalBs)}</span></>}
                </button>
            </div>
        </div>
    )
}
