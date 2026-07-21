// src/pages/AddressBookPage.jsx
// Libreta de Direcciones - Content-only component (rendered inside AdminPage or POSPage wrapper)
import { useState, useMemo } from 'react'
import { useAllCustomers } from '../hooks/useAllCustomers'
import { createCustomer, updateCustomer, deleteCustomer, getCustomerHistory, addCredit } from '../services/customerService'
import { formatUSD } from '../utils/money'
import { useToast } from '../components/Toast'

export default function AddressBookPage() {
    const { customers, loading } = useAllCustomers()
    const toast = useToast()

    const [search, setSearch] = useState('')
    const [newClientOpen, setNewClientOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newNotes, setNewNotes] = useState('')

    const [editClientOpen, setEditClientOpen] = useState(false)
    const [editClientData, setEditClientData] = useState(null)
    const [editName, setEditName] = useState('')
    const [editPhone, setEditPhone] = useState('')
    const [editNotes, setEditNotes] = useState('')

    const [deleteClientOpen, setDeleteClientOpen] = useState(false)
    const [deleteClientData, setDeleteClientData] = useState(null)

    const [viewingClient, setViewingClient] = useState(null)
    const [clientOrders, setClientOrders] = useState([])
    const [ordersLoading, setOrdersLoading] = useState(false)

    const [creditModalOpen, setCreditModalOpen] = useState(false)
    const [creditClientData, setCreditClientData] = useState(null)
    const [creditAmount, setCreditAmount] = useState('')

    const norm = (p) => (p || '').replace(/\D/g, '')
    const searchLower = search.toLowerCase().trim()
    const searchDigits = search.replace(/\D/g, '')

    const filtered = useMemo(() => {
        if (!search) return customers
        return customers.filter(c => {
            const nameMatch = c.name?.toLowerCase().trim().includes(searchLower)
            const phoneMatch = searchDigits && (c.phone?.includes(search) || norm(c.phone).includes(searchDigits))
            return nameMatch || phoneMatch
        })
    }, [customers, search, searchLower, searchDigits])

    const handleCreateClient = async () => {
        if (!newName.trim() || !newPhone.trim()) return
        try {
            await createCustomer({ name: newName, phone: newPhone, notes: newNotes })
            toast.success('Cliente creado correctamente.')
            setNewClientOpen(false)
            setNewName('')
            setNewPhone('')
            setNewNotes('')
        } catch (err) {
            console.error(err)
            toast.error('Error al crear el cliente.')
        }
    }

    const handleEditClient = (client) => {
        setEditClientData(client)
        setEditName(client.name || '')
        setEditPhone(client.phone || '')
        setEditNotes(client.notes || '')
        setEditClientOpen(true)
    }

    const handleSaveEditClient = async () => {
        if (!editName.trim() || !editPhone.trim() || !editClientData?.id) return
        try {
            await updateCustomer(editClientData.id, { name: editName, phone: editPhone, notes: editNotes })
            toast.success('Cliente actualizado correctamente.')
            setEditClientOpen(false)
            setEditClientData(null)
        } catch (err) {
            console.error(err)
            toast.error('Error al actualizar el cliente.')
        }
    }

    const handleConfirmDelete = (client) => {
        setDeleteClientData(client)
        setDeleteClientOpen(true)
    }

    const handleDeleteClient = async () => {
        if (!deleteClientData?.id) return
        try {
            await deleteCustomer(deleteClientData.id)
            toast.success(`${deleteClientData.name} eliminado correctamente.`)
            setDeleteClientOpen(false)
            setDeleteClientData(null)
        } catch (err) {
            console.error(err)
            toast.error('Error al eliminar el cliente.')
        }
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

    // ─── Historial view ───────────────────────────────────
    if (viewingClient) {
        return (
            <div className="space-y-4">
                <button onClick={() => setViewingClient(null)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all">← Volver a la lista</button>
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
                                        {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(o.createdAt.seconds * 1000).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : '—'}
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
            </div>
        )
    }

    // ─── Main address book view ───────────────────────────
    return (
        <div className="space-y-3">
            {/* Search + New button */}
            <div className="flex gap-2">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input-field flex-1"
                    placeholder="🔍 Buscar por nombre o teléfono"
                    autoFocus
                />
                <button onClick={() => setNewClientOpen(true)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl transition-all shrink-0">➕ Nuevo</button>
            </div>

            {/* Client count */}
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</p>

            {/* Client list */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                        <p className="text-4xl mb-2">📭</p>
                        <p className="text-slate-500 text-sm">{search ? 'Sin resultados' : 'No hay clientes registrados'}</p>
                    </div>
                ) : (
                    filtered.map(c => (
                        <div key={c.id} className="bg-[#1E293B] rounded-2xl px-4 py-3 border border-white/5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                                        {(c.creditBalance || 0) > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 shrink-0">💰 {formatUSD(c.creditBalance)}</span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-xs">📱 {c.phone}</p>
                                    {c.notes && <p className="text-slate-500 text-[10px]">📝 {c.notes}</p>}
                                    <p className="text-slate-600 text-[10px] mt-0.5">{c.totalOrders || 0} visitas · {formatUSD(c.totalSpent || 0)}</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5 mt-2 pt-2 border-t border-white/5">
                                <button onClick={() => handleViewHistory(c)} className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors">📋 Historial</button>
                                <button onClick={() => handleEditClient(c)} className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors">✏️ Editar</button>
                                <button onClick={() => { setCreditClientData(c); setCreditAmount(''); setCreditModalOpen(true) }} className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">💰 Crédito</button>
                                <button onClick={() => handleConfirmDelete(c)} className="text-[11px] font-bold py-2 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">🗑️</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal: Nuevo cliente */}
            {newClientOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => setNewClientOpen(false)}>
                    <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-white mb-5">➕ Nuevo Cliente</h2>
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
                                <button onClick={handleCreateClient} disabled={!newName.trim() || !newPhone.trim()} className="btn-primary flex-1">Crear Cliente</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar cliente */}
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
                                <button onClick={handleSaveEditClient} disabled={!editName.trim() || !editPhone.trim()} className="btn-primary flex-1">Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmar eliminación */}
            {deleteClientOpen && deleteClientData && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 pt-8 sm:pt-4" onClick={() => { setDeleteClientOpen(false); setDeleteClientData(null) }}>
                    <div className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-white mb-2">⚠️ Eliminar Cliente</h2>
                        <p className="text-slate-400 text-sm mb-1">¿Estás seguro de eliminar a <span className="text-white font-semibold">{deleteClientData.name}</span>?</p>
                        <p className="text-red-400 text-xs mb-5">Esta acción no se puede deshacer. Se eliminará todo el historial de este cliente.</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setDeleteClientOpen(false); setDeleteClientData(null) }} className="btn-secondary flex-1">Cancelar</button>
                            <button onClick={handleDeleteClient} className="flex-1 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-2.5 px-5 rounded-xl transition-all text-sm">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Abonar crédito */}
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
        </div>
    )
}
