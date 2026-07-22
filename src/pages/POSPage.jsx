// src/pages/POSPage.jsx
import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSession } from '../context/SessionContext'
import { useCart } from '../context/CartContext'
import { useNav } from '../context/NavigationContext'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { useCustomers } from '../hooks/useCustomers'
import { useOpenOrders } from '../hooks/useOpenOrders'
import { useMultipleOpenOrderItems } from '../hooks/useOpenOrderItems'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { saveHoldOrder, appendHoldOrder, updateHoldOrder, cancelHoldOrder, getOrderItems, completeHoldOrder } from '../services/orderService'
import { createCustomer, ensureCustomerByPhone, getCustomerHistory, updateCustomer, addCredit, findCustomerByPhone, findCustomerByName } from '../services/customerService'
import { addAbono, getAbonosByCustomer, getTotalAbonosByCustomer } from '../services/abonoService'
import { DEFAULT_USER } from '../context/AuthContext'
import LogoIcon from '../components/LogoIcon'
import { formatUSD } from '../utils/money'
import { getCategoryColor } from '../utils/categoryColors'
import { useToast } from '../components/Toast'
import AddressBookPage from './AddressBookPage'

export default function POSPage() {
    const { role } = useAuth()
    const { session } = useSession()
    const { items, totalUSD, itemCount, dispatch } = useCart()
    const { setScreen, setAdminTab, setHoldOrderId, selectedClient, setSelectedClient } = useNav()
    const { products, loading } = useProducts()
    const { categories } = useCategories()
    const { customers } = useCustomers()
    const { orders: holdOrders } = useOpenOrders()
    const watchedOrderIds = useMemo(() => {
        const ids = (holdOrders || []).slice(0, 5).map(o => o.id)
        const current = selectedClient?.orderId
        if (current && !ids.includes(current)) ids.unshift(current)
        return [...new Set(ids.filter(Boolean))].slice(0, 5)
    }, [holdOrders, selectedClient?.orderId])
    const { itemsMap } = useMultipleOpenOrderItems(watchedOrderIds)
    const isOnline = useOnlineStatus()
    const toast = useToast()

    const [posMode, setPosMode] = useState('select')
    const [search, setSearch] = useState('')
    const [newClientOpen, setNewClientOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [cartCollapsed, setCartCollapsed] = useState(true)
    const [viewingClient, setViewingClient] = useState(null)
    const [clientOrders, setClientOrders] = useState([])
    const [ordersLoading, setOrdersLoading] = useState(false)
    const [expandedOrderId, setExpandedOrderId] = useState(null)
    const [expandedOrderItems, setExpandedOrderItems] = useState([])
    const [itemsLoading, setItemsLoading] = useState(false)

    const [pendingClientCreation, setPendingClientCreation] = useState(null)
    const [expandedLogs, setExpandedLogs] = useState({})
    const [editClientOpen, setEditClientOpen] = useState(false)
    const [editClientData, setEditClientData] = useState(null)
    const [editName, setEditName] = useState('')
    const [editPhone, setEditPhone] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [creditModalOpen, setCreditModalOpen] = useState(false)
    const [creditClientData, setCreditClientData] = useState(null)
    const [creditAmount, setCreditAmount] = useState('')
    const [abonoModalOpen, setAbonoModalOpen] = useState(false)
    const [abonoClientData, setAbonoClientData] = useState(null)
    const [abonoAmount, setAbonoAmount] = useState('')
    const [abonoCurrency, setAbonoCurrency] = useState('USD')
    const [abonoHistory, setAbonoHistory] = useState([])
    const [clientAbonosUSD, setClientAbonosUSD] = useState(0)
    const [openAbonosMap, setOpenAbonosMap] = useState({})
    const [phoneToCustomerId, setPhoneToCustomerId] = useState({})
    const [abonoLoading, setAbonoLoading] = useState(false)

    // Refrescar datos de abonos para un cliente y todas las cuentas abiertas
    const refreshAbonos = async (forCustomerId) => {
        if (forCustomerId) {
            try {
                const total = await getTotalAbonosByCustomer(forCustomerId)
                setClientAbonosUSD(total)
            } catch { setClientAbonosUSD(0) }
        }
        try {
            const openOrders = holdOrders.filter(o => o.status === 'open')
            const phoneMap = {}
            for (const o of openOrders) {
                const phone = (o.client?.phone || '').trim()
                if (!o.customerId && phone) {
                    try {
                        const customer = await findCustomerByPhone(phone)
                        if (customer) phoneMap[phone] = customer.id
                    } catch {}
                }
            }
            setPhoneToCustomerId(phoneMap)
            const ids = [...new Set(openOrders.map(o => o.customerId || phoneMap[(o.client?.phone || '').trim()]).filter(Boolean))]
            const map = {}
            await Promise.all(ids.map(async (id) => {
                try { map[id] = await getTotalAbonosByCustomer(id) } catch { map[id] = 0 }
            }))
            setOpenAbonosMap(map)
        } catch {}
    }

    // Refrescar abonos al cambiar de cliente
    useEffect(() => {
        if (selectedClient?.id) {
            refreshAbonos(selectedClient.id)
        } else {
            setClientAbonosUSD(0)
        }
    }, [selectedClient?.id])

    // Cargar abonos de clientes con cuentas abiertas
    useEffect(() => {
        refreshAbonos(null)
    }, [holdOrders])

    // Auto-cerrar órdenes donde los abonos cubren el total
    useEffect(() => {
        if (!openAbonosMap || Object.keys(openAbonosMap).length === 0) return
        const openOrders = holdOrders.filter(o => o.status === 'open')
        for (const o of openOrders) {
            const effectiveId = o.customerId || phoneToCustomerId[(o.client?.phone || '').trim()] || null
            if (!effectiveId) continue
            const abonado = openAbonosMap[effectiveId] || 0
            const restante = Math.max(0, (o.totalUSD || 0) - abonado)
            if (restante <= 0.005) {
                completeHoldOrder(o.id).catch(() => {})
            }
        }
    }, [openAbonosMap, holdOrders, phoneToCustomerId])

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

    // Cargar cliente pendiente de localStorage y reintentar cuando hay conexión
    useEffect(() => {
        const saved = localStorage.getItem('pendingClientCreation')
        if (saved) {
            const parsed = JSON.parse(saved)
            setPendingClientCreation(parsed)
        }
    }, [])

    useEffect(() => {
        if (isOnline && pendingClientCreation) {
            createClientInBackground(pendingClientCreation)
        }
    }, [isOnline, pendingClientCreation])

    // Cargar total de abonos USD del cliente seleccionado
    useEffect(() => {
        const customerId = selectedClient?.id
        if (customerId && customerId.length >= 20) {
            getTotalAbonosByCustomer(customerId).then(setClientAbonosUSD).catch(() => setClientAbonosUSD(0))
        } else {
            setClientAbonosUSD(0)
        }
    }, [selectedClient])

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
                        <p className="text-slate-400 text-[11px] leading-none mt-1">by #JDMRules</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {role === 'admin' && (
                            <button onClick={() => setScreen?.('admin')} className="text-sm text-slate-400 hover:text-blue-400 transition-colors font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-500/10">⚙️ Admin</button>
                        )}
                    </div>
                </header>
                <main className="flex-1 flex flex-col items-center justify-start px-6 pt-6 gap-6">
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
        const norm = (p) => (p || '').replace(/\D/g, '')
        const searchLower = search.toLowerCase().trim()
        const searchDigits = search.replace(/\D/g, '')
        const filtered = customers.filter(c => {
            if (!search) return true
            const nameMatch = c.name?.toLowerCase().trim().includes(searchLower)
            const phoneMatch = searchDigits && (c.phone?.includes(search) || norm(c.phone).includes(searchDigits))
            return nameMatch || phoneMatch
        })
        const openOrders = holdOrders.filter(o => o.status === 'open')
        const openClients = openOrders.map(o => ({
            id: o.customerId || null,
            name: o.client?.name || '—',
            phone: o.client?.phone || '',
            totalUSD: o.totalUSD || 0,
            itemCount: o.itemCount || 0,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            orderId: o.id,
        }))
        const filteredOpens = openClients.filter(o => {
            if (!search) return true
            const nameMatch = o.name?.toLowerCase().trim().includes(searchLower)
            const phoneMatch = searchDigits && (o.phone?.includes(search) || norm(o.phone).includes(searchDigits))
            const result = nameMatch || phoneMatch
            return result
        }).sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0))
        const matchedOpenPhones = new Set(filteredOpens.map(o => o.phone))
        const filteredNonOpen = filtered.filter(c => !matchedOpenPhones.has(c.phone))

        const handleSelectClient = (client) => {
            const matched = customers.find(c => norm(c.phone) === norm(client.phone))
            const resolvedClient = matched
                ? { ...client, id: matched.id }
                : { ...client, id: null }
            const openOrder = openOrders.find(o =>
                norm(o.client?.phone) === norm(client.phone) ||
                (o.client?.name || '').toLowerCase() === (client.name || '').toLowerCase()
            )
            setSelectedClient({ ...resolvedClient, orderId: openOrder?.id || client.orderId })
            if (openOrder) {
                setPosMode('client-summary')
            } else {
                dispatch({ type: 'CLEAR_CART' })
                setPosMode('client-products')
            }
        }

        const createClientInBackground = async (clientData) => {
            try {
                const created = await createCustomer(clientData)
                localStorage.removeItem('pendingClientCreation')
                setPendingClientCreation(null)
                setSelectedClient(created)
            } catch (err) {
                console.error(err)
                // Reintentar cuando vuelva la conexión (manejado por useEffect)
            }
        }

        const handleNewClient = async () => {
            if (!newName.trim() || !newPhone.trim()) return

            const trimmedName = newName.trim()
            const trimmedPhone = newPhone.trim()

            try {
                const existingPhone = await findCustomerByPhone(trimmedPhone)
                if (existingPhone) {
                    toast.error(`Ya existe un cliente con el teléfono ${trimmedPhone} (${existingPhone.name})`)
                    return
                }
                const existingName = await findCustomerByName(trimmedName)
                if (existingName) {
                    toast.error(`Ya existe un cliente con el nombre "${trimmedName}"`)
                    return
                }
            } catch {
                toast.error('Error al verificar duplicados.')
                return
            }

            const clientData = {
                name: trimmedName,
                phone: trimmedPhone,
                notes: newNotes.trim()
            }

            setNewClientOpen(false)
            setNewName('')
            setNewPhone('')
            setNewNotes('')
            dispatch({ type: 'CLEAR_CART' })
            setSelectedClient({ ...clientData, id: null })
            setPosMode('client-products')

            createClientInBackground(clientData).catch(() => {
                localStorage.setItem('pendingClientCreation', JSON.stringify(clientData))
                setPendingClientCreation(clientData)
            })
        }

        const handleViewHistory = async (client) => {
            if (!client?.id) {
                toast.error('Este cliente no tiene historial registrado.')
                return
            }
            setViewingClient(client)
            setOrdersLoading(true)
            try {
                const ordersList = await getCustomerHistory(client.id)
                setClientOrders(ordersList)
            } catch (err) {
                console.error(err)
                toast.error('Error al cargar el historial.')
                setClientOrders([])
            } finally {
                setOrdersLoading(false)
            }
        }

        const handleEditClient = (client) => {
            if (!client?.id) {
                toast.error('No se puede editar este cliente.')
                return
            }
            setEditClientData(client)
            setEditName(client.name || '')
            setEditPhone(client.phone || '')
            setEditNotes(client.notes || '')
            setEditClientOpen(true)
        }

        const handleSaveEditClient = async () => {
            if (!editName.trim() || !editPhone.trim() || !editClientData?.id) return

            const trimmedName = editName.trim()
            const trimmedPhone = editPhone.trim()
            const currentId = editClientData.id

            try {
                const existingPhone = await findCustomerByPhone(trimmedPhone)
                if (existingPhone && existingPhone.id !== currentId) {
                    toast.error(`Ya existe otro cliente con el teléfono ${trimmedPhone} (${existingPhone.name})`)
                    return
                }
                const existingName = await findCustomerByName(trimmedName)
                if (existingName && existingName.id !== currentId) {
                    toast.error(`Ya existe otro cliente con el nombre "${trimmedName}"`)
                    return
                }
            } catch {
                toast.error('Error al verificar duplicados.')
                return
            }

            try {
                await updateCustomer(currentId, { name: trimmedName, phone: trimmedPhone, notes: editNotes })
                toast.success('Cliente actualizado correctamente.')
                setEditClientOpen(false)
                setEditClientData(null)
            } catch (err) {
                console.error(err)
                toast.error('Error al actualizar el cliente.')
            }
        }

        const handleAddCredit = async () => {
            if (!creditClientData?.id || !creditAmount || parseFloat(creditAmount) <= 0) return
            try {
                const amount = parseFloat(creditAmount)
                await addCredit(creditClientData.id, amount)
                toast.success(`$${amount.toFixed(2)} abonados al crédito de ${creditClientData.name}`)
                setCreditModalOpen(false)
                setCreditClientData(null)
                setCreditAmount('')
            } catch (err) {
                console.error(err)
                toast.error('Error al abonar crédito.')
            }
        }

        const handleAddAbono = async () => {
            if (abonoLoading) return
            setAbonoLoading(true)
            let clientId = abonoClientData?.id
            if (!clientId && abonoClientData?.phone) {
                try {
                    const found = await findCustomerByPhone(abonoClientData.phone)
                    if (found) clientId = found.id
                } catch {}
            }
            if (!clientId || !abonoAmount || parseFloat(abonoAmount) <= 0) {
                setAbonoLoading(false)
                return
            }
            try {
                const amount = parseFloat(abonoAmount)
                const rate = session?.exchangeRate || null
                await addAbono({
                    customerId: clientId,
                    customerName: abonoClientData.name,
                    amountEntered: amount,
                    currency: abonoCurrency,
                    exchangeRateUsed: abonoCurrency === 'BS' ? rate : null,
                    orderId: abonoClientData.orderId || null,
                })
                toast.success(`${abonoCurrency === 'USD' ? '$' : 'Bs'}${amount.toFixed(2)} abonados a la cuenta de ${abonoClientData.name}`)
                setAbonoModalOpen(false)
                setAbonoClientData(null)
                setAbonoAmount('')
                setAbonoCurrency('USD')
                setAbonoHistory([])
                await refreshAbonos(clientId)
            } catch (err) {
                console.error(err)
                toast.error('Error al registrar abono.')
            } finally {
                setAbonoLoading(false)
            }
        }

        const handleOpenAbono = async (client) => {
            let clientId = client.id
            if (!clientId && client.phone) {
                try {
                    const found = await findCustomerByPhone(client.phone)
                    if (found) clientId = found.id
                } catch {}
            }
            const clientWithId = { ...client, id: clientId || null }
            setAbonoClientData(clientWithId)
            setAbonoAmount('')
            setAbonoCurrency('USD')
            setAbonoModalOpen(true)
            try {
                const history = clientId ? await getAbonosByCustomer(clientId) : []
                setAbonoHistory(history.slice(0, 10))
            } catch { setAbonoHistory([]) }
        }

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
                                    <div key={o.id}>
                                        <div
                                            onClick={async () => {
                                                if (expandedOrderId === o.id) {
                                                    setExpandedOrderId(null)
                                                    setExpandedOrderItems([])
                                                    return
                                                }
                                                setExpandedOrderId(o.id)
                                                setItemsLoading(true)
                                                try {
                                                    const items = await getOrderItems(o.id)
                                                    setExpandedOrderItems(items)
                                                } catch {
                                                    setExpandedOrderItems([])
                                                } finally {
                                                    setItemsLoading(false)
                                                }
                                            }}
                                            className={`bg-[#1E293B] rounded-2xl px-4 py-3 flex justify-between items-center border transition-colors cursor-pointer ${expandedOrderId === o.id ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 hover:bg-white/5'}`}
                                        >
                                            <div>
                                                <p className="text-white text-xs font-semibold">
                                                    {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(o.createdAt.seconds * 1000).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : '—'}
                                                </p>
                                                <p className="text-slate-500 text-[10px]">
                                                    {o.invoiceNumber ? `#${String(o.invoiceNumber).padStart(4, '0')}` : ''} · {o.paymentMethod}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-blue-400 font-extrabold text-sm">{formatUSD(o.totalUSD || 0)}</p>
                                                <p className="text-slate-600 text-[10px]">{expandedOrderId === o.id ? '▲' : '▼'}</p>
                                            </div>
                                        </div>
                                        {expandedOrderId === o.id && (
                                            <div className="bg-[#1a2332] rounded-b-2xl px-4 py-3 border border-t-0 border-blue-500/20 -mt-1">
                                                {itemsLoading ? (
                                                    <div className="flex items-center justify-center py-4"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                                                ) : expandedOrderItems.length === 0 ? (
                                                    <p className="text-slate-500 text-[11px] text-center py-2">Sin ítems</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {expandedOrderItems.map(item => (
                                                            <div key={item.productId} className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm">{item.emoji || '📦'}</span>
                                                                    <span className="text-white text-[11px]">{item.name}</span>
                                                                    <span className="text-slate-500 text-[10px]">×{item.qty}</span>
                                                                </div>
                                                                <span className="text-slate-300 text-[11px] font-semibold">{formatUSD(item.subtotalUSD || 0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                     <div className="flex items-center gap-2">
                         <p className="text-white font-bold text-sm">🍽️ Clientes</p>
                         {pendingClientCreation && (
                             <div className="flex items-center gap-1 text-[10px] text-blue-400">
                                 <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                 Creando cliente...
                             </div>
                         )}
                     </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPosMode('address-book')} className="text-xs font-bold bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 px-3 py-2 rounded-xl transition-all">📒 Libreta</button>
                        <button onClick={() => setNewClientOpen(true)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl transition-all">➕ Nuevo</button>
                    </div>
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
                    {/* Pestañas abiertas (siempre visibles y filtrables) */}
                    {filteredOpens.length > 0 && (() => {
                        const totalAbiertas = filteredOpens.reduce((s, o) => {
                                        const effectiveId = o.id || phoneToCustomerId[o.phone?.trim()] || null
                                        return s + Math.max(0, o.totalUSD - (effectiveId ? (openAbonosMap[effectiveId] || 0) : 0))
                                    }, 0)
                        return (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-green-400 text-xs font-bold uppercase tracking-wider">🟢 Cuentas Abiertas</p>
                                <p className="text-green-400 text-sm font-extrabold">{formatUSD(totalAbiertas)}</p>
                            </div>
                            <div className="space-y-2">
                                {filteredOpens.map(o => {
                                            const effectiveId = o.id || phoneToCustomerId[o.phone?.trim()] || null
                                            const restante = Math.max(0, o.totalUSD - (effectiveId ? (openAbonosMap[effectiveId] || 0) : 0))
                                    if (restante <= 0) return null
                                    return (
                                    <div key={o.orderId} className="bg-green-500/5 border border-green-500/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                                        <button onClick={() => handleSelectClient({ id: o.id, name: o.name, phone: o.phone, orderId: o.orderId })} className="flex-1 text-left">
                                            <p className="text-white font-semibold text-sm">{o.name}</p>
                                            {openAbonosMap[effectiveId] > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                                                    💰 Abonado: {formatUSD(openAbonosMap[effectiveId])}
                                                </span>
                                            )}
                                            <p className="text-slate-400 text-xs">{o.phone}</p>
                                        </button>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenAbono({ id: o.customerId || null, name: o.name, phone: o.phone, totalUSD: o.totalUSD, orderId: o.orderId }) }} className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors">💰 Abonar</button>
                                            <div className="text-right">
                                                <p className="text-blue-400 font-extrabold">{formatUSD(restante)}</p>
                                                <p className="text-slate-500 text-[10px]">{o.itemCount} ítems</p>
                                            </div>
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                        )
                    })()}

                    {/* Últimos clientes (sin duplicar los que tienen pestaña abierta) */}
                    <div>
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">🔵 Últimos Clientes</p>
                        {filteredNonOpen.length === 0 ? (
                            <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                                <p className="text-slate-500 text-sm">Sin resultados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredNonOpen.map(c => (
                                    <div key={c.id} className="bg-[#1E293B] rounded-2xl px-4 py-3 flex items-center justify-between border border-white/5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                                                {(c.creditBalance || 0) > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">💰 {formatUSD(c.creditBalance)}</span>
                                                )}
                                            </div>
                                            <p className="text-slate-400 text-xs">📱 {c.phone}</p>
                                            {c.notes && <p className="text-slate-500 text-[10px]">📝 {c.notes}</p>}
                                            <p className="text-slate-600 text-[10px]">{c.totalOrders || 0} visitas · {formatUSD(c.totalSpent || 0)}</p>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-2">
                                             <button onClick={() => handleViewHistory(c)} className="text-base font-bold w-10 h-10 rounded-lg bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors flex items-center justify-center">📋</button>
                                             <button onClick={() => handleEditClient(c)} className="text-base font-bold w-10 h-10 rounded-lg bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors flex items-center justify-center">✏️</button>
                                             <button onClick={() => { setCreditClientData(c); setCreditAmount(''); setCreditModalOpen(true) }} className="text-base font-bold w-10 h-10 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex items-center justify-center">💰</button>
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
                     <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => setNewClientOpen(false)}>
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
                                    <button onClick={handleNewClient} disabled={!newName.trim() || !newPhone.trim()} className="btn-primary flex-1">
                                        Crear y Asignar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal editar cliente */}
                {editClientOpen && (
                    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => { setEditClientOpen(false); setEditClientData(null) }}>
                        <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-white mb-5">✏️ Editar Cliente</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="label-xs">Nombre</label>
                                    <input value={editName} onChange={e => setEditName(e.target.value)} className="input-field mt-1" placeholder="Nombre del cliente" autoFocus />
                                </div>
                                <div>
                                    <label className="label-xs">Teléfono</label>
                                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="input-field mt-1" placeholder="0412-1234567" inputMode="tel" />
                                </div>
                                <div>
                                    <label className="label-xs">Notas (opcional)</label>
                                    <input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="input-field mt-1" placeholder="ej. Hijo de Juan" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => { setEditClientOpen(false); setEditClientData(null) }} className="btn-secondary flex-1">Cancelar</button>
                                    <button onClick={handleSaveEditClient} disabled={!editName.trim() || !editPhone.trim()} className="btn-primary flex-1">
                                        Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal abonar crédito */}
                {creditModalOpen && creditClientData && (
                    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => { setCreditModalOpen(false); setCreditClientData(null); setCreditAmount('') }}>
                        <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-white mb-2">💰 Abonar Crédito</h2>
                            <p className="text-slate-400 text-xs mb-5">Cliente: <span className="text-white font-semibold">{creditClientData.name}</span></p>
                            {(creditClientData.creditBalance || 0) > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 mb-4">
                                    <p className="text-green-400 text-xs font-bold">Saldo actual: {formatUSD(creditClientData.creditBalance)}</p>
                                </div>
                            )}
                            <div className="space-y-4">
                                <div>
                                    <label className="label-xs">Monto a abonar (USD)</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={creditAmount}
                                            onChange={e => setCreditAmount(e.target.value)}
                                            className="input-field pl-10"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => { setCreditModalOpen(false); setCreditClientData(null); setCreditAmount('') }} className="btn-secondary flex-1">Cancelar</button>
                                    <button onClick={handleAddCredit} disabled={!creditAmount || parseFloat(creditAmount) <= 0} className="bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-600/30 flex-1 disabled:opacity-40 disabled:pointer-events-none">
                                        Abonar {creditAmount ? formatUSD(parseFloat(creditAmount)) : ''}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal abonar a cuenta */}
                {abonoModalOpen && abonoClientData && (
                    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => { setAbonoModalOpen(false); setAbonoClientData(null); setAbonoAmount(''); setAbonoCurrency('USD'); setAbonoHistory([]) }}>
                        <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-white mb-2">💰 Abonar a Cuenta</h2>
                            <p className="text-slate-400 text-xs mb-4">Cliente: <span className="text-white font-semibold">{abonoClientData.name}</span></p>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 mb-4">
                                <p className="text-red-400 text-xs font-bold">Deuda actual: {formatUSD(abonoClientData.totalUSD || 0)}</p>
                            </div>
                            <div className="space-y-4">
                                {/* Selector de moneda */}
                                <div>
                                    <label className="label-xs">Abonar en</label>
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            onClick={() => setAbonoCurrency('USD')}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${abonoCurrency === 'USD' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                                        >
                                            💵 USD
                                        </button>
                                        <button
                                            onClick={() => setAbonoCurrency('BS')}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${abonoCurrency === 'BS' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                                        >
                                            💴 Bs
                                        </button>
                                    </div>
                                    {abonoCurrency === 'BS' && session?.exchangeRate && (
                                        <p className="text-slate-400 text-[10px] mt-1">Tasa fija (Bs por $): {session.exchangeRate.toFixed(2)}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="label-xs">Monto del abono {abonoCurrency === 'USD' ? '(USD)' : '(Bs)'}</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{abonoCurrency === 'USD' ? '$' : 'Bs'}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max={abonoCurrency === 'USD' ? (abonoClientData.totalUSD || 0) : ((abonoClientData.totalUSD || 0) * (session?.exchangeRate || 1))}
                                            value={abonoAmount}
                                            onChange={e => {
                                                const max = abonoCurrency === 'USD'
                                                    ? (abonoClientData.totalUSD || 0)
                                                    : ((abonoClientData.totalUSD || 0) * (session?.exchangeRate || 1))
                                                const val = Math.min(parseFloat(e.target.value) || 0, max)
                                                setAbonoAmount(Math.max(0, val).toString())
                                            }}
                                            className="input-field pl-12"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    {abonoCurrency === 'BS' && session?.exchangeRate && abonoAmount && (
                                        <p className="text-slate-500 text-[10px] mt-1">≈ {formatUSD(parseFloat(abonoAmount || '0') / session.exchangeRate)}</p>
                                    )}
                                    <div className="flex justify-between mt-1">
                                        <button onClick={() => {
                                            const max = abonoCurrency === 'USD'
                                                ? (abonoClientData.totalUSD || 0)
                                                : ((abonoClientData.totalUSD || 0) * (session?.exchangeRate || 1))
                                            setAbonoAmount(max.toString())
                                        }} className="text-[10px] text-green-400 font-bold">Abonar todo</button>
                                        <p className="text-slate-500 text-[10px]">
                                            Restante: {formatUSD(Math.max(0, (abonoClientData.totalUSD || 0) - (abonoCurrency === 'USD'
                                                ? (parseFloat(abonoAmount) || 0)
                                                : ((parseFloat(abonoAmount) || 0) / (session?.exchangeRate || 1))
                                            )))}
                                        </p>
                                    </div>
                                </div>
                                {abonoHistory.length > 0 && (
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold mb-2">Abonos anteriores:</p>
                                        <div className="space-y-1">
                                            {abonoHistory.map(a => (
                                                <div key={a.id} className="flex justify-between text-[11px]">
                                                    <span className="text-slate-500">
                                                        {a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) : '—'}
                                                        <span className="text-slate-600 ml-1">{a.currency === 'BS' ? 'Bs' : '$'}</span>
                                                    </span>
                                                    <span className="text-green-400 font-bold">
                                                        {a.currency === 'BS' ? `Bs${(a.amount || 0).toFixed(2)}` : formatUSD(a.amountUSD || a.amount || 0)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => { setAbonoModalOpen(false); setAbonoClientData(null); setAbonoAmount(''); setAbonoCurrency('USD'); setAbonoHistory([]) }} className="btn-secondary flex-1">Cancelar</button>
                                    <button onClick={handleAddAbono} disabled={!abonoAmount || parseFloat(abonoAmount) <= 0 || abonoLoading} className="bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-600/30 flex-1 disabled:opacity-40 disabled:pointer-events-none">
                                        {abonoLoading ? 'Procesando...' : `Abonar ${abonoCurrency === 'USD' ? formatUSD(parseFloat(abonoAmount || '0')) : `Bs${(parseFloat(abonoAmount) || 0).toFixed(2)}`}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ─── Modo: Libreta de Direcciones ────────────────────
    if (posMode === 'address-book') {
        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col">
                <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <button onClick={() => setPosMode('client')} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Clientes</button>
                    <p className="text-white font-bold text-sm">📒 Libreta de Direcciones</p>
                    <div className="w-20" />
                </header>
                <main className="flex-1 px-4 pt-4 overflow-auto">
                    <AddressBookPage />
                </main>
            </div>
        )
    }

    // ─── Modo: Resumen del Cliente ──────────────────────
    if (posMode === 'client-summary') {
        const rate = session?.exchangeRate || null
        const displayItems = selectedClient?.orderId ? (itemsMap[selectedClient.orderId] || []) : []

        const handleGoToProducts = () => {
            dispatch({ type: 'CLEAR_CART' })
            displayItems.forEach(item => {
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
        const summaryTotal = displayItems.reduce((s, i) => s + Number(i.subtotalUSD), 0)
        const summaryTotalBs = rate ? summaryTotal * rate : 0

        const handleQtyChange = async (productId, delta) => {
            const newItems = displayItems.map(item => {
                if (item.productId !== productId) return item
                const newQty = item.qty + delta
                if (newQty <= 0) return null
                const now = Date.now()
                const log = [...(item.log || [])]
                const lastEntry = log.length > 0 ? log[log.length - 1] : null
                if (lastEntry && (now - lastEntry.addedAt < 2000) && Math.sign(lastEntry.qty) === Math.sign(delta)) {
                    log[log.length - 1] = { qty: lastEntry.qty + delta, addedAt: now }
                } else {
                    log.push({ qty: delta, addedAt: now })
                }
                return {
                    ...item,
                    qty: newQty,
                    subtotalUSD: newQty * item.unitPriceUSD,
                    log,
                }
            }).filter(Boolean)
            try {
                if (newItems.length === 0) {
                    await cancelHoldOrder(selectedClient?.orderId)
                    setSelectedClient(prev => ({ ...prev, orderId: null }))
                    setPosMode('client')
                    return
                }
                await updateHoldOrder(selectedClient?.orderId, newItems)
            } catch (err) {
                console.error(err)
                toast.error('Error al actualizar la cantidad.')
            }
        }

        const handleRemoveItem = async (productId) => {
            const newItems = displayItems.filter(item => item.productId !== productId)
            try {
                if (newItems.length === 0) {
                    await cancelHoldOrder(selectedClient?.orderId)
                    setSelectedClient(prev => ({ ...prev, orderId: null }))
                    setPosMode('client')
                    return
                }
                await updateHoldOrder(selectedClient?.orderId, newItems)
            } catch (err) {
                console.error(err)
                toast.error('Error al eliminar el producto.')
            }
        }

        const handleWhatsAppSummary = () => {
            if (!whatsappPhone) return
            const lines = displayItems.map(i => `${i.emoji} ${i.name} x${i.qty} — ${formatUSD(i.subtotalUSD)}`).join('\n')
            const nuevoTotal = Math.max(0, summaryTotal - clientAbonosUSD)
            const abonoLine = clientAbonosUSD > 0 ? `\n💰 *Abonos previos: -${formatUSD(clientAbonosUSD)}*\n` : ''
            const msg = `🍔 *La KZ* — Detalle de tu cuenta\n\nHola *${selectedClient?.name}*, aquí el resumen:\n\n${lines}${abonoLine}\n💵 *Total a pagar: ${formatUSD(nuevoTotal)}*\n\n*Datos del Pago Movil*\n👤 Rafael Garrido\n📱 04143047502\nV-13536210\n🏦 0102 (Banco de Venezuela)\n\n_La KZ POS by #JDMRules_\nSiguenos en @lakz_ct`
            window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        }

        return (
            <div className="min-h-screen bg-[#0F172A] flex flex-col pb-32">
                <header className="bg-[#1E293B] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <button onClick={() => setPosMode('client')} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Clientes</button>
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
                    {displayItems.length === 0 ? (
                        <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                            <p className="text-4xl mb-2">📭</p>
                            <p className="text-slate-500 text-sm">No hay productos en esta cuenta</p>
                        </div>
                    ) : (
                        <div className="bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5">
                            <div className="px-4 py-3 border-b border-white/5">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">🛒 Productos ({displayItems.length})</p>
                            </div>
                            <div className="divide-y divide-white/5">
                                {displayItems.map(item => (
                                    <div key={item.productId} className="px-3 py-2.5">
                                        <div className="grid grid-cols-[1fr_auto] gap-2">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <span className="text-4xl shrink-0 leading-none mt-0.5">{item.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-white text-lg font-bold leading-tight truncate">{item.name}</p>
                                                    <p className="text-slate-500 text-xs mt-0.5">{formatUSD(item.unitPriceUSD)} c/u{rate ? <span className="text-slate-600"> · Bs {(item.unitPriceUSD * rate).toFixed(2)} c/u</span> : null}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-blue-400 font-extrabold text-3xl leading-none">{formatUSD(item.subtotalUSD)}</p>
                                                {rate && <p className="text-slate-400 text-sm font-semibold mt-0.5">Bs {(item.subtotalUSD * rate).toFixed(2)}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <div>
                                                {item.log && item.log.length > 0 && (
                                                    <button
                                                        onClick={() => setExpandedLogs(prev => ({ ...prev, [item.productId]: !prev[item.productId] }))}
                                                        className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors font-semibold"
                                                    >
                                                        {expandedLogs[item.productId] ? '🔼 Ocultar Detalles' : `📋 Detalles (${item.log.reduce((s, e) => s + e.qty, 0) > 0 ? '+' : ''}${item.log.reduce((s, e) => s + e.qty, 0)})`}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleQtyChange(item.productId, -1)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold text-base transition-colors flex items-center justify-center">−</button>
                                                <span className="text-white font-bold text-base w-8 text-center">{item.qty}</span>
                                                <button onClick={() => handleQtyChange(item.productId, 1)} className="w-9 h-9 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-base transition-colors flex items-center justify-center">+</button>
                                                <button onClick={() => handleRemoveItem(item.productId)} className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-base transition-colors flex items-center justify-center ml-1">🗑️</button>
                                            </div>
                                        </div>
                                        {expandedLogs[item.productId] && item.log && item.log.length > 0 && (
                                            <div className="mt-1.5 space-y-0.5 pl-1">
                                                {[...item.log].reverse().slice(0, 15).map((entry, idx) => (
                                                    <p key={idx} className={`text-[10px] ${entry.qty > 0 ? 'text-slate-600' : 'text-red-400'}`}>
                                                        {(entry.qty > 0 ? '+' : '') + entry.qty} · {new Date(entry.addedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} {new Date(entry.addedAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}
                                                    </p>
                                                ))}
                                                {item.log.length > 15 && (
                                                    <p className="text-slate-600 text-[10px]">+{item.log.length - 15} más...</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                                {clientAbonosUSD > 0 && (
                                    <p className="text-green-400 text-[10px] font-bold">💰 Abonos previos: -{formatUSD(clientAbonosUSD)}</p>
                                )}
                                <p className="text-white font-bold text-sm">Total</p>
                                <div className="text-right">
                                    <p className="text-blue-400 font-extrabold">{formatUSD(Math.max(0, summaryTotal - clientAbonosUSD))}</p>
                                    {rate && <p className="text-slate-500 text-[10px]">Bs {Math.max(0, summaryTotal - clientAbonosUSD) * rate} <span className={clientAbonosUSD > 0 ? 'line-through text-slate-600' : ''}>{clientAbonosUSD > 0 ? formatUSD(summaryTotal) : ''}</span></p>}
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Acciones fijas abajo */}
                <div className="fixed bottom-0 left-0 right-0 z-20 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="flex gap-2">
                         <button onClick={() => setPosMode('client')} className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-3 px-3 rounded-xl transition-all text-sm">← Volver</button>
                         <button onClick={async () => {
                             if (selectedClient?.orderId && displayItems.length > 0) {
                                 try { await updateHoldOrder(selectedClient.orderId, displayItems) } catch {}
                             }
                             setPosMode('client')
                         }} className="flex-1 bg-slate-600 hover:bg-slate-500 active:scale-[0.98] text-white font-bold py-3 px-3 rounded-xl transition-all text-sm">💾 Guardar</button>
                        <button onClick={handleGoToProducts} className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 px-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm">➕ Agregar</button>
                        <button onClick={() => {
                            dispatch({ type: 'CLEAR_CART' })
                            displayItems.forEach(item => {
                                dispatch({ type: 'ADD_ITEM', payload: { id: item.productId, name: item.name, emoji: item.emoji, priceUSD: item.unitPriceUSD } })
                                if (item.qty > 1) {
                                    for (let i = 1; i < item.qty; i++) {
                                        dispatch({ type: 'ADD_ITEM', payload: { id: item.productId, name: item.name, emoji: item.emoji, priceUSD: item.unitPriceUSD } })
                                    }
                                }
                            })
                            setHoldOrderId(selectedClient?.orderId); setScreen('ticket')
                        }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold py-3 px-3 rounded-xl transition-all text-sm">💳 Cobrar</button>
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
        if (!session?.id) return
        if (items.length === 0) {
            if (client?.orderId) {
                try {
                    await cancelHoldOrder(client.orderId)
                    setSelectedClient({ ...client, orderId: null })
                } catch (err) {
                    console.error(err)
                    toast.error('Error al cancelar la cuenta.')
                }
            }
            dispatch({ type: 'CLEAR_CART' })
            return
        }
        try {
            if (client?.orderId) {
                await updateHoldOrder(client.orderId, items)
                if (client?.phone) {
                    ensureCustomerByPhone({ name: client.name, phone: client.phone, notes: client.notes }).catch(() => {})
                }
            } else {
                const customerId = client?.id?.length >= 20 ? client.id : null
                const id = await saveHoldOrder({
                    cashierId: DEFAULT_USER.uid,
                    sessionId: session.id,
                    items,
                    client: { name: client?.name || '—', phone: client?.phone || '' },
                    notes: client?.notes || '',
                    customerId,
                })
                setSelectedClient({ ...client, orderId: id })
                if (client?.phone) {
                    ensureCustomerByPhone({ name: client.name, phone: client.phone, notes: client.notes }).catch(() => {})
                }
            }
            dispatch({ type: 'CLEAR_CART' })
        } catch (err) {
            console.error(err)
            toast.error('Error al guardar la cuenta. Intenta de nuevo.')
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
            const msg = `🍔 *La KZ* — Detalle de tu cuenta\n\nHola *${client?.name}*, aquí el resumen:\n\n${lines}\n\n💵 *Total: ${formatUSD(order?.totalUSD || totalUSD)}*\n\n*Datos del Pago Movil*\n👤 Rafael Garrido\n📱 04143047502\nV-13536210\n🏦 0102 (Banco de Venezuela)\n\n_La KZ POS by #JDMRules_\nSiguenos en @lakz_ct`
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
        } catch (err) {
            console.error(err)
            toast.error('Error al abrir WhatsApp.')
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
                    <button onClick={() => setPosMode('client')} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base px-5 py-3 rounded-xl transition-all">← Clientes</button>
                </div>
                <div className="text-right">
                     {isClientMode && client && (
                         <div className="flex items-center gap-1.5">
                             <p className="text-white text-xs font-semibold truncate max-w-[140px]">{client.name}</p>
                             {pendingClientCreation && (
                                 <div className="flex items-center gap-1 text-[10px] text-blue-400">
                                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                     Creando...
                                 </div>
                             )}
                         </div>
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
                                    <button onClick={handleCharge} className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 px-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm">💳 Cobrar {formatUSD(totalUSD)}</button>
                                    <button onClick={() => { handleSaveTab(); setPosMode('client') }} className="flex-1 bg-slate-600 hover:bg-slate-500 active:scale-[0.98] text-white font-bold py-3 px-3 rounded-xl transition-all text-sm">💾 Guardar</button>
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
            className={`${bg} rounded-2xl p-4 relative flex flex-col transition-all border ${qty > 0 ? 'border-blue-500/40' : border} ${qty === 0 ? 'cursor-pointer active:scale-[0.97]' : ''}`}
            onClick={qty === 0 ? onAdd : undefined}
        >
            {qty > 0 && (
                <span className="absolute top-1 right-1 bg-blue-600 text-white text-base font-extrabold w-10 h-10 rounded-full flex items-center justify-center shadow-lg">{qty}</span>
            )}
            <div className="text-3xl text-center mt-1 mb-2">{product.emoji}</div>
            <p className="text-white text-base font-bold text-center leading-tight mb-1 line-clamp-2">{product.name}</p>
            <p className="text-blue-400 text-base font-extrabold text-center mb-2">${(product.priceUSD || 0).toFixed(2)}</p>
            {qty > 0 && (
                <div className="mt-auto pt-2 flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-sm transition-colors active:scale-95">−</button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors active:scale-95">+</button>
                </div>
            )}
        </div>
    )
}
