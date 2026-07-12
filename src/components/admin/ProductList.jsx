// src/components/admin/ProductList.jsx
import { useState } from 'react'
import { useProducts } from '../../hooks/useProducts'
import { deleteProduct, toggleProduct } from '../../services/productService'
import ProductForm from './ProductForm'
import { useToast } from '../Toast'
import { formatBsNum } from '../../utils/money'

export default function ProductList() {
    const { products, loading } = useProducts()
    const toast = useToast()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [search, setSearch] = useState('')
    const [confirm, setConfirm] = useState(null) // id a eliminar

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
    )

    // Agrupar por categoría
    const grouped = filtered.reduce((acc, p) => {
        acc[p.category] = acc[p.category] || []
        acc[p.category].push(p)
        return acc
    }, {})

    const handleDelete = async (id) => {
        try {
            await deleteProduct(id)
            setConfirm(null)
            toast.success('Producto eliminado')
        } catch (err) {
            console.error(err)
            toast.error('Error al eliminar el producto.')
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="space-y-4">
            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Buscar producto..."
                    className="input-field flex-1"
                    aria-label="Buscar producto"
                />
                <button
                    onClick={() => { setEditing(null); setShowForm(true) }}
                    className="btn-primary whitespace-nowrap"
                >
                    + Nuevo
                </button>
            </div>

            {/* Lista agrupada */}
            {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <div className="text-5xl mb-3">📦</div>
                    <p className="font-semibold">No hay productos aún</p>
                    <p className="text-sm mt-1">Crea el primer producto con el botón de arriba</p>
                </div>
            ) : (
                Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat}>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                            {cat} <span className="text-blue-400 ml-1">{items.length}</span>
                        </p>
                        <div className="space-y-2">
                            {items.map(p => (
                                <div
                                    key={p.id}
                                    className={`flex items-center gap-3 bg-[#1E293B] rounded-2xl px-4 py-3 transition-opacity ${!p.active ? 'opacity-40' : ''}`}
                                >
                                    <span className="text-2xl">{p.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                                        <p className="text-slate-400 text-xs">Bs {formatBsNum(p.priceBS)}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* Toggle activo */}
                                        <button
                                            onClick={() => toggleProduct(p.id, !p.active)}
                                            aria-label={p.active ? `Desactivar ${p.name}` : `Activar ${p.name}`}
                                            className={`text-[11px] px-3 py-2.5 rounded-lg font-bold transition-colors ${p.active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                        >
                                            {p.active ? '✓ Activo' : '○ Inactivo'}
                                        </button>
                                        {/* Editar */}
                                        <button
                                            onClick={() => { setEditing(p); setShowForm(true) }}
                                            aria-label={`Editar ${p.name}`}
                                            className="text-[11px] px-3 py-2.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-bold transition-colors"
                                        >
                                            ✏️ Editar
                                        </button>
                                        {/* Eliminar */}
                                        <button
                                            onClick={() => setConfirm(p.id)}
                                            aria-label={`Eliminar ${p.name}`}
                                            className="text-[11px] px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold transition-colors"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {/* Modal crear/editar */}
            {showForm && (
                <ProductForm
                    product={editing}
                    onClose={() => { setShowForm(false); setEditing(null) }}
                />
            )}

            {/* Modal confirmar eliminación */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
                    <div className="bg-[#1E293B] rounded-[24px] p-6 w-full max-w-sm text-center shadow-2xl">
                        <div className="text-4xl mb-3">🗑️</div>
                        <h3 className="text-white font-bold text-lg mb-1">¿Eliminar producto?</h3>
                        <p className="text-slate-400 text-sm mb-6">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
                            <button
                                onClick={() => handleDelete(confirm)}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
