// src/pages/POSPage.jsx
import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSession } from '../context/SessionContext'
import { useCart } from '../context/CartContext'
import { useNav } from '../context/NavigationContext'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { useCustomers } from '../hooks/useCustomers'
import { useOpenOrders } from '../hooks/useOpenOrders'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { saveHoldOrder, appendHoldOrder, updateHoldOrder, getOrderItems } from '../services/orderService'
import { createCustomer, findCustomerByPhone } from '../services/customerService'
import { DEFAULT_USER } from '../context/AuthContext'
import LogoIcon from '../components/LogoIcon'
import { formatUSD } from '../utils/money'
import { getCategoryColor } from '../utils/categoryColors'

export default function POSPage() {
    const { role } = useAuth()
    const { session } = useSession()
    const { items, totalUSD, itemCount, dispatch } = useCart()
    const { setScreen, setAdminTab, setHoldOrderId, selectedClient, setSelectedClient } = useNav()
    const { products, loading } = useProducts()
    const { categories } = useCategories()
    const { customers } = useCustomers()
    const { orders: holdOrders } = useOpenOrders()
    const isOnline = useOnlineStatus()

    const [posMode, setPosMode] = useState('select')
    const [search, setSearch] = useState('')
    const [summaryItems, setSummaryItems] = useState([])
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [newClientOpen, setNewClientOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [clientSaving, setClientSaving] = useState(false)
    const [cartCollapsed, setCartCollapsed] = useState(true)
    const [viewingClient, setViewingClient] = useState(null)
    const [clientOrders, setClientOrders] = useState([])
    const [ordersLoading, setOrdersLoading] = useState(false)

    const activeProducts = products.filter(p => p.active)

    const groupedProducts = useMemo(() => {
        const map = {}
        activeProducts.forEach(p => {
            const cat = p.category || 'Otros'
            if (!map[cat]) map[cat] = []
            map[cat].push(p)
        })
        return Object.entries(map)
    }, [activeProducts])

    // Guardia: si no hay sesión activa
    if (session?.status !== 'open' && !loading) {
        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
                <div className="text-5xl mb-4">🏪</div>
                <h2 className="text-white text-xl font-bold mb-2">Caja cerrada</h2>
                <p className="text-slate-400 text-sm mb-8">Puedes revisar reportes y administración, o abrir la caja para facturar.</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button onClick={() => { setAdminTab('caja'); setScreen('admin') }} className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/30 text-sm">🏪 Abrir Caja</button>
                    <button onClick={() => setScreen('admin')} className="w-full bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-2xl transition-all text-sm">📊 Administración</button>
                </div>
            </div>
        )
    }

    // ─── Modo: Selección ─────────────────────────────────
    if (posMode === 'select') {
        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col">
                <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <div>
                        <p className="text-white font-bold text-sm leading-none flex items-center gap-1">
                            <LogoIcon className="w-4 h-4 inline-block" /> La KZ POS
                            {!isOnline && <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Offline</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {role === 'admin' && (
                            <button onClick={() => setScreen?.('admin')} className="text-sm text-slate-400 hover:text-blue-400 transition-colors font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-500/10">⚙️ Admin</button>
                        )}
                    </div>
                </header>
                <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
                    <button
                        onClick={() => { setPosMode('client'); dispatch({ type: 'CLEAR_CART' }); setSelectedClient(null) }}
                        className="w-full max-w-sm bg-[#1E293B] hover:bg-[#2a3649] border border-white/10 rounded-3xl p-8 text-center transition-all active:scale-[0.98]"
                    >
                        <span className="text-5xl block mb-4">🍽️</span>
                        <p className="text-white font-extrabold text-xl mb-1">Seleccionar Cliente</p>
                        <p className="text-slate-400 text-sm">Restaurante / Pestañas</p>
                    </button>
                    <button
                        onClick={() => { setPosMode('quick-products'); dispatch({ type: 'CLEAR_CART' }); setSelectedClient(null) }}
                        className="w-full max-w-sm bg-[#1E293B] hover:bg-[#2a3649] border border-white/10 rounded-3xl p-8 text-center transition-all active:scale-[0.98]"
                    >
                        <span className="text-5xl block mb-4">⚡</span>
                        <p className="text-white font-extrabold text-xl mb-1">Factura Rápida</p>
                        <p className="text-slate-400 text-sm">Venta directa sin cliente</p>
                    </button>
                </main>
            </div>
        )
    }

    // ─── Modo: Lista de Clientes ─────────────────────────
    if (posMode === 'client') {
        const filtered = customers.filter(c =>
            !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
        )
        const openOrders = holdOrders.filter(o => o.status === 'open')
        const handleSelectClient = async (client) => {
            // Buscar customerId real desde la lista de clientes frecuentes
            const matched = customers.find(c => c.phone === client.phone)
            const resolvedClient = matched
                ? { ...client, id: matched.id }
                : { ...client, id: null }
            const openOrder = openOrders.find(o => o.client?.name === client.name && o.client?.phone === client.phone)
            setSelectedClient({ ...resolvedClient, orderId: openOrder?.id || client.orderId })
            if (openOrder) {
                setSummaryLoading(true)
                setPosMode('client-summary')
                try {
                    const orderItems = await getOrderItems(openOrder.id)
                    setSummaryItems(orderItems)
                } catch {
                    setSummaryItems([])
                } finally {
                    setSummaryLoading(false)
                }
            } else {
                dispatch({ type: 'CLEAR_CART' })
                setPosMode('client-products')
            }
        }

        const handleNewClient = async () => {
            if (!newName.trim() || !newPhone.trim()) return
            setClientSaving(true)
            try {
                const existing = await findCustomerByPhone(newPhone.trim())
                if (existing) {
                    setSelectedClient(existing)
                    setNewClientOpen(false)
                    setNewName('')
                    setNewPhone('')
                    setNewNotes('')
                    dispatch({ type: 'CLEAR_CART' })
                    setPosMode('client-products')
                    return
                }
                const created = await createCustomer({ name: newName, phone: newPhone, notes: newNotes })
                setSelectedClient(created)
                setNewClientOpen(false)
                setNewName('')
                setNewPhone('')
                setNewNotes('')
                dispatch({ type: 'CLEAR_CART' })
                setPosMode('client-products')
            } catch (err) {
                console.error(err)
            } finally {
                setClientSaving(false)
            }
        }

        const handleViewHistory = async (client) => {
            setViewingClient(client)
            setOrdersLoading(true)
            try {
                const { getCustomerHistory } = await import('../services/customerService')
                const ordersList = await getCustomerHistory(client.id)
                setClientOrders(ordersList)
            } catch (err) {
                console.error(err)
                setClientOrders([])
            } finally {
                setOrdersLoading(false)
            }
        }

        const openClients = openOrders.map(o => ({
            id: null,
            name: o.client?.name || '—',
            phone: o.client?.phone || '',
            totalUSD: o.totalUSD || 0,
            itemCount: o.itemCount || 0,
            createdAt: o.createdAt,
            orderId: o.id,
        }))

        if (viewingClient) {
            return (
                <div className="min-h-screen bg-[#0F172A] flex flex-col">
                    <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                        <button onClick={() => setViewingClient(null)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Volver</button>
                        <p className="text-white font-bold text-sm">📋 Historial</p>
                        <div className="w-20" />
                    </header>
                    <main className="flex-1 px-4 pt-4 space-y-4">
                        <div className="bg-[#1E293B] rounded-2xl p-4 border border-white/5">
                            <p className="text-white font-bold text-lg">{viewingClient.name}</p>
                            <p className="text-slate-400 text-xs">📱 {viewingClient.phone}</p>
                            {viewingClient.notes && <p className="text-slate-500 text-xs mt-1">📝 {viewingClient.notes}</p>}
                            <p className="text-slate-500 text-xs mt-2">{viewingClient.totalOrders || 0} visitas · {formatUSD(viewingClient.totalSpent || 0)}</p>
                        </div>
                        {ordersLoading ? (
                            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : clientOrders.length === 0 ? (
                            <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                                <p className="text-4xl mb-2">📭</p>
                                <p className="text-slate-500 text-sm">No hay órdenes anteriores</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {clientOrders.map(o => (
                                    <div key={o.id} className="bg-[#1E293B] rounded-2xl px-4 py-3 flex justify-between items-center border border-white/5">
                                        <div>
                                            <p className="text-white text-xs font-semibold">
                                                {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </p>
                                            <p className="text-slate-500 text-[10px]">
                                                {o.invoiceNumber ? `#${String(o.invoiceNumber).padStart(4, '0')}` : ''} · {o.paymentMethod}
                                            </p>
                                        </div>
                                        <p className="text-blue-400 font-extrabold text-sm">{formatUSD(o.totalUSD || 0)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            )
        }

        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col">
                <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <button onClick={() => setPosMode('select')} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Inicio</button>
                    <p className="text-white font-bold text-sm">🍽️ Clientes</p>
                    <button onClick={() => setNewClientOpen(true)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl transition-all">➕ Nuevo</button>
                </header>

                <div className="px-4 pt-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input-field w-full"
                        placeholder="🔍 Buscar por nombre o teléfono"
                    />
                </div>

                <main className="flex-1 px-4 pt-3 space-y-4 overflow-auto pb-8">
                    {/* Pestañas abiertas */}
                    {openClients.length > 0 && !search && (
                        <div>
                            <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">🟢 Pestañas Abiertas</p>
                            <div className="space-y-2">
                                {openClients.map(o => (
                                    <button key={o.orderId} onClick={() => handleSelectClient({ id: o.id, name: o.name, phone: o.phone, orderId: o.orderId })}
                                        className="w-full bg-green-500/5 border border-green-500/10 rounded-2xl px-4 py-3 flex items-center justify-between text-left active:scale-[0.99] transition-all"
                                    >
                                        <div>
                                            <p className="text-white font-semibold text-sm">{o.name}</p>
                                            <p className="text-slate-400 text-xs">{o.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-blue-400 font-extrabold">{formatUSD(o.totalUSD)}</p>
                                            <p className="text-slate-500 text-[10px]">{o.itemCount} ítems</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Últimos clientes */}
                    <div>
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">🔵 Últimos Clientes</p>
                        {filtered.length === 0 ? (
                            <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                                <p className="text-slate-500 text-sm">Sin resultados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filtered.map(c => (
                                    <div key={c.id} className="bg-[#1E293B] rounded-2xl px-4 py-3 flex items-center justify-between border border-white/5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                                            <p className="text-slate-400 text-xs">📱 {c.phone}</p>
                                            {c.notes && <p className="text-slate-500 text-[10px]">📝 {c.notes}</p>}
                                            <p className="text-slate-600 text-[10px]">{c.totalOrders || 0} visitas · {formatUSD(c.totalSpent || 0)}</p>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-2">
                                            <button onClick={() => handleViewHistory(c)} className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors">📋</button>
                                            <button onClick={() => handleSelectClient(c)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors">Seleccionar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                {/* Modal nuevo cliente */}
                {newClientOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={() => setNewClientOpen(false)}>
                        <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-white mb-5">✏️ Nuevo Cliente</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="label-xs">Nombre</label>
                                    <input value={newName} onChange={e => setNewName(e.target.value)} className="input-field mt-1" placeholder="Nombre del cliente" autoFocus />
                                </div>
                                <div>
                                    <label className="label-xs">Teléfono</label>
                                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} className="input-field mt-1" placeholder="0412-1234567" inputMode="tel" />
                                </div>
                                <div>
                                    <label className="label-xs">Notas (opcional)</label>
                                    <input value={newNotes} onChange={e => setNewNotes(e.target.value)} className="input-field mt-1" placeholder="ej. Hijo de Juan" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setNewClientOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                                    <button onClick={handleNewClient} disabled={clientSaving || !newName.trim() || !newPhone.trim()} className="btn-primary flex-1">
                                        {clientSaving ? 'Guardando...' : 'Crear y Asignar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ─── Modo: Resumen del Cliente ──────────────────────
    if (posMode === 'client-summary') {
        const rate = session?.exchangeRate || null

        const handleGoToProducts = () => {
            dispatch({ type: 'CLEAR_CART' })
            summaryItems.forEach(item => {
                dispatch({ type: 'ADD_ITEM', payload: { id: item.productId, name: item.name, emoji: item.emoji, priceUSD: item.unitPriceUSD } })
                if (item.qty > 1) {
                    for (let i = 1; i < item.qty; i++) {
                        dispatch({ type: 'ADD_ITEM', payload: { id: item.productId, name: item.name, emoji: item.emoji, priceUSD: item.unitPriceUSD } })
                    }
                }
            })
            setPosMode('client-products')
        }

        const whatsappPhone = selectedClient?.phone?.replace(/^0/, '58')
        const summaryTotal = summaryItems.reduce((s, i) => s + Number(i.subtotalUSD), 0)
        const summaryTotalBs = rate ? summaryTotal * rate : 0

        const handleQtyChange = async (productId, delta) => {
            const newItems = summaryItems.map(item => {
                if (item.productId !== productId) return item
                const newQty = item.qty + delta
                if (newQty <= 0) return null
                return {
                    ...item,
                    qty: newQty,
                    subtotalUSD: newQty * item.unitPriceUSD,
                    log: [...(item.log || []), { qty: delta, addedAt: Date.now() }],
                }
            }).filter(Boolean)
            setSummaryItems(newItems)
            try {
                await updateHoldOrder(selectedClient?.orderId, newItems)
            } catch (err) {
                console.error(err)
            }
        }

        const handleRemoveItem = async (productId) => {
            const newItems = summaryItems
                .filter(item => item.productId !== productId)
            setSummaryItems(newItems)
            try {
                await updateHoldOrder(selectedClient?.orderId, newItems)
            } catch (err) {
                console.error(err)
            }
        }

        const handleWhatsAppSummary = () => {
            if (!whatsappPhone) return
            const lines = summaryItems.map(i => `${i.emoji} ${i.name} x${i.qty} — ${formatUSD(i.subtotalUSD)}`).join('\n')
            const msg = `🍔 *La KZ* — Detalle de tu cuenta\n\nHola *${selectedClient?.name}*, aquí el resumen:\n\n${lines}\n\n💵 *Total: ${formatUSD(summaryTotal)}*\n\n*Datos del Pago Movil*\n📱 04122098241\nV-22034344\n🏦 0134 (Banesco)\n\nGracias por tu visita 🙏`
            window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        }

        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col pb-32">
                <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <button onClick={() => { setPosMode('client'); setSummaryItems([]) }} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Clientes</button>
                    <p className="text-white font-bold text-sm">Resumen de Cuenta</p>
                    {rate && <p className="text-slate-500 text-[10px]">Bs {rate.toFixed(2)}</p>}
                </header>

                <main className="flex-1 px-4 pt-4 space-y-4 overflow-auto">
                    {/* Info del cliente */}
                    <div className="bg-[#1E293B] rounded-2xl p-4 border border-white/5">
                        <p className="text-white font-bold text-lg">{selectedClient?.name}</p>
                        <p className="text-slate-400 text-xs">📱 {selectedClient?.phone}</p>
                        {selectedClient?.notes && <p className="text-slate-500 text-xs mt-0.5">📝 {selectedClient.notes}</p>}
                    </div>

                    {/* Lista de productos */}
                    {summaryLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : summaryItems.length === 0 ? (
                        <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                            <p className="text-4xl mb-2">📭</p>
                            <p className="text-slate-500 text-sm">No hay productos en esta cuenta</p>
                        </div>
                    ) : (
                        <div className="bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5">
                            <div className="px-4 py-3 border-b border-white/5">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">🛒 Productos ({summaryItems.length})</p>
                            </div>
                            <div className="divide-y divide-white/5">
                                {summaryItems.map(item => (
                                    <div key={item.productId} className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-base shrink-0">{item.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-xs font-semibold truncate">{item.name}</p>
                                                <p className="text-slate-500 text-[10px]">{formatUSD(item.unitPriceUSD)} c/u</p>
                                                {rate && <p className="text-slate-600 text-[10px]">Bs {(item.unitPriceUSD * rate).toFixed(2)} c/u</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-blue-400 font-bold text-xs">{formatUSD(item.subtotalUSD)}</p>
                                                {rate && <p className="text-slate-500 text-[10px]">Bs {(item.subtotalUSD * rate).toFixed(2)}</p>}
                                            </div>
                                        </div>
                                        {/* Log de tiempos (cada acción individual, bajas en rojo) */}
                                        {item.log && item.log.length > 0 && (
                                            <div className="mt-1.5 space-y-0.5">
                                                {[...item.log].reverse().slice(0, 15).map((entry, idx) => (
                                                    <p key={idx} className={`text-[10px] ${entry.qty > 0 ? 'text-slate-600' : 'text-red-400'}`}>
                                                        {entry.qty > 0 ? '+' : ''}{entry.qty} · {new Date(entry.addedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </p>
                                                ))}
                                                {item.log.length > 15 && (
                                                    <p className="text-slate-600 text-[10px]">+{item.log.length - 15} más...</p>
                                                )}
                                            </div>
                                        )}
                                        {/* Botones modificar */}
                                        <div className="flex items-center justify-end gap-1 mt-2">
                                            <button onClick={() => handleQtyChange(item.productId, -1)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors">−</button>
                                            <span className="text-white font-bold text-sm w-8 text-center">{item.qty}</span>
                                            <button onClick={() => handleQtyChange(item.productId, 1)} className="w-8 h-8 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-sm transition-colors">+</button>
                                            <button onClick={() => handleRemoveItem(item.productId)} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors ml-2">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                                <p className="text-white font-bold text-sm">Total</p>
                                <div className="text-right">
                                    <p className="text-blue-400 font-extrabold">{formatUSD(summaryTotal)}</p>
                                    {rate && <p className="text-slate-500 text-[10px]">Bs {summaryTotalBs.toFixed(2)}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Acciones fijas abajo */}
                <div className="fixed bottom-0 left-0 right-0 z-20 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="flex gap-2">
                        <button onClick={() => { setPosMode('client'); setSummaryItems([]) }} className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-3 px-3 rounded-xl transition-all text-sm">← Volver</button>
                        <button onClick={handleGoToProducts} className="flex-[2] bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 px-5 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm">➕ Agregar Productos</button>
                        <button onClick={() => { setHoldOrderId(selectedClient?.orderId); setScreen('ticket') }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold py-3 px-3 rounded-xl transition-all text-sm">💳 Cobrar</button>
                        <button onClick={handleWhatsAppSummary} className="flex-1 bg-green-600/15 hover:bg-green-600/25 border border-green-500/20 active:scale-[0.98] text-green-400 font-bold py-3 px-3 rounded-xl transition-all text-sm">📱 WhatsApp</button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Modo: Productos ──────────────────────────────────
    const isClientMode = posMode === 'client-products'
    const client = selectedClient

    const handleSaveTab = async () => {
        if (!session?.id || items.length === 0) return
        try {
            if (client?.orderId) {
                await appendHoldOrder(client.orderId, items)
            } else {
                const id = await saveHoldOrder({
                    cashierId: DEFAULT_USER.uid,
                    sessionId: session.id,
                    items,
                    client: { name: client?.name || '—', phone: client?.phone || '' },
                    notes: client?.notes || '',
                })
                setSelectedClient({ ...client, orderId: id })
            }
            dispatch({ type: 'CLEAR_CART' })
        } catch (err) {
            console.error(err)
        }
    }

    const handleWhatsApp = async () => {
        if (!client?.orderId && !client?.phone) return
        const orderId = client?.orderId
        if (!orderId) return
        try {
            const orderItems = await getOrderItems(orderId)
            const order = holdOrders.find(o => o.id === orderId)
            const phone = client?.phone?.replace(/^0/, '58')
            const lines = orderItems.map(i => `${i.emoji} ${i.name} x${i.qty} — ${formatUSD(i.subtotalUSD)}`).join('\n')
            const msg = `🍔 *La KZ* — Detalle de tu cuenta\n\nHola *${client?.name}*, aquí el resumen:\n\n${lines}\n\n💵 *Total: ${formatUSD(order?.totalUSD || totalUSD)}*\n\n*Datos del Pago Movil*\n📱 04122098241\nV-22034344\n🏦 0134 (Banesco)\n\nGracias por tu visita 🙏`
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
        } catch (err) {
            console.error(err)
        }
    }

    const handleCharge = () => {
        if (isClientMode && client?.orderId) {
            setHoldOrderId(client.orderId)
        } else {
            setHoldOrderId(null)
        }
        setScreen('ticket')
    }

    return (
        <div className="min-h-screen bg-[#0F172A] flex flex-col pb-28">
            {/* Header */}
            <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    {isClientMode ? (
                        <button onClick={() => { handleSaveTab(); setPosMode('client') }} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Clientes</button>
                    ) : (
                        <button onClick={() => setPosMode('select')} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Inicio</button>
                    )}
                </div>
                <div className="text-right">
                    {isClientMode && client && (
                        <p className="text-white text-xs font-semibold truncate max-w-[140px]">{client.name}</p>
                    )}
                    <p className="text-blue-400 font-extrabold text-lg leading-none">{formatUSD(totalUSD)}</p>
                </div>
            </header>

            {/* Grilla de Productos */}
            <main className="flex-1 px-4 pt-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : activeProducts.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <div className="text-5xl mb-3">📦</div>
                        <p className="font-semibold">Sin productos</p>
                        {products.length === 0 ? <p className="text-sm mt-1">El Admin debe cargar el menú primero</p> : <p className="text-sm mt-1">No hay productos activos</p>}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedProducts.map(([category, catProducts]) => {
                            const catDef = categories.find(c => c.name === category)
                            const color = getCategoryColor(catDef?.color)
                            return (
                                <div key={category}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-3 h-3 rounded-full ${color.swatch}`} />
                                        <h3 className={`text-xs font-bold uppercase tracking-wider ${color.text}`}>{category}</h3>
                                        <span className="text-slate-600 text-[11px]">({catProducts.length})</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {catProducts.map(product => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                qty={items.find(i => i.productId === product.id)?.qty || 0}
                                                onAdd={() => dispatch({ type: 'ADD_ITEM', payload: product })}
                                                onRemove={() => dispatch({ type: 'DECREMENT_ITEM', payload: product.id })}
                                                categoryColor={color}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* Cart Bar flotante inferior */}
            {itemCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-20 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1 cursor-pointer select-none" onClick={() => setCartCollapsed(c => !c)}>
                            <span className="text-white font-extrabold text-lg leading-none">{formatUSD(totalUSD)}</span>
                            <span className="text-slate-400 text-xs flex items-center gap-1">
                                {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                                <span className="text-slate-600 text-[11px]">{cartCollapsed ? '▲' : '▼'}</span>
                            </span>
                        </div>

                        {!cartCollapsed && (
                            <div className="w-full flex flex-col gap-1 max-h-40 overflow-y-auto">
                                {items.map(item => (
                                    <div key={item.productId} className="flex items-center justify-between px-1 gap-2">
                                        <span className="text-xs text-slate-300 flex items-center gap-1.5 flex-1 min-w-0">
                                            <span>{item.emoji}</span>
                                            <span className="truncate">{item.qty}× {item.name}</span>
                                            {item.log?.length > 0 && (
                                                <span className="text-slate-600 text-[10px] shrink-0">
                                                    · {Math.round((Date.now() - (item.log[item.log.length - 1]?.addedAt || Date.now())) / 60000)}min
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs font-bold text-blue-400 shrink-0">{formatUSD(item.subtotalUSD)}</span>
                                        <button onPointerDown={e => { e.stopPropagation(); dispatch({ type: 'DECREMENT_ITEM', payload: item.productId }) }} className="shrink-0 w-10 h-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 active:scale-90 transition-all text-lg font-bold leading-none flex items-center justify-center">−</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 mt-1">
                            {isClientMode ? (
                                <>
                                    <button onClick={() => { handleSaveTab(); setPosMode('client') }} className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-3 px-3 rounded-xl transition-all text-sm">← Regresar</button>
                                    <button onClick={handleCharge} className="flex-[2] bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 px-5 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm">💳 Cobrar {formatUSD(totalUSD)}</button>
                                    <button onClick={handleWhatsApp} className="flex-1 bg-green-600/15 hover:bg-green-600/25 border border-green-500/20 active:scale-[0.98] text-green-400 font-bold py-3 px-3 rounded-xl transition-all text-sm">📱 WhatsApp</button>
                                </>
                            ) : (
                                <button onClick={handleCharge} className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 px-5 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm">💳 Cobrar {formatUSD(totalUSD)}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ── Componente ProductCard ── */
function ProductCard({ product, qty, onAdd, onRemove, categoryColor }) {
    const { bg = 'bg-[#1E293B]', border = 'border-white/5' } = categoryColor || {}
    return (
        <div
            className={`${bg} rounded-2xl p-3 relative flex flex-col transition-all border ${qty > 0 ? 'border-blue-500/40' : border} ${qty === 0 ? 'cursor-pointer active:scale-[0.97]' : ''}`}
            onClick={qty === 0 ? onAdd : undefined}
        >
            {qty > 0 && (
                <span className="absolute top-1 right-1 bg-blue-600 text-white text-sm font-extrabold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">{qty}</span>
            )}
            <div className="text-3xl text-center mt-1 mb-2">{product.emoji}</div>
            <p className="text-white text-xs font-semibold text-center leading-tight mb-0.5 line-clamp-2">{product.name}</p>
            <p className="text-blue-400 text-sm font-extrabold text-center mb-2">${(product.priceUSD || 0).toFixed(2)}</p>
            {qty > 0 && (
                <div className="mt-auto pt-2 flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl text-sm transition-colors active:scale-95">−</button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm transition-colors active:scale-95">+</button>
                </div>
            )}
        </div>
    )
}
