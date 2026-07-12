// src/components/admin/ProductForm.jsx
import { useState } from 'react'
import { createProduct, updateProduct } from '../../services/productService'

const EMOJIS = ['🥞', '🥩', '🥪', '🫓', '🧀', '🫔', '🥓', '🍽️', '🍗', '🥤', '🍟', '🍋', '🥨', '🌮', '🍕', '☕', '🧋']

const empty = { name: '', emoji: '🍺', category: 'Otros', priceBS: '', active: true }

export default function ProductForm({ product, onClose }) {
    const [form, setForm] = useState(product ? { ...product, priceBS: product.priceBS.toString() } : empty)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const editing = !!product

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        const price = parseFloat(form.priceBS)
        if (isNaN(price) || price <= 0) { setError('El precio debe ser mayor a 0'); return }
        setSaving(true)
        try {
            const payload = { ...form, priceBS: price, category: 'Otros' }
            if (editing) await updateProduct(product.id, payload)
            else await createProduct(payload)
            onClose()
        } catch (err) {
            setError('Error al guardar. Intenta de nuevo.')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
            <div
                className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-white mb-5">
                    {editing ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Emoji picker */}
                    <div>
                        <label className="label-xs">Emoji</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {EMOJIS.map(e => (
                                <button
                                    key={e} type="button"
                                    onClick={() => set('emoji', e)}
                                    className={`text-2xl p-1.5 rounded-xl transition-all ${form.emoji === e ? 'bg-blue-600 scale-110' : 'bg-[#0F172A] hover:bg-blue-600/30'}`}
                                >{e}</button>
                            ))}
                        </div>
                    </div>

                    {/* Nombre */}
                    <div>
                        <label className="label-xs">Nombre del Producto</label>
                        <input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            className="input-field"
                            placeholder="ej. Polar Light 350ml"
                            required
                        />
                    </div>

                    {/* Precio */}
                    <div>
                        <label className="label-xs">Precio (Bs.)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Bs</span>
                            <input
                                type="number" step="0.01" min="0.01"
                                value={form.priceBS}
                                onChange={e => set('priceBS', e.target.value)}
                                className="input-field pl-10"
                                placeholder="0,00"
                                required
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
