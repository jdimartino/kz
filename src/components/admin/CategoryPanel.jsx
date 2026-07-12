// src/components/admin/CategoryPanel.jsx
import { useState } from 'react'
import { useCategories } from '../../hooks/useCategories'
import { createCategory, updateCategory, deleteCategory } from '../../services/categoryService'
import CATEGORY_COLORS, { getCategoryColor } from '../../utils/categoryColors'

export default function CategoryPanel() {
    const { categories, loading } = useCategories()
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', color: 'amber' })
    const [saving, setSaving] = useState(false)

    const openNew = () => {
        setEditing('new')
        setForm({ name: '', color: 'amber' })
    }

    const openEdit = (cat) => {
        setEditing(cat.id)
        setForm({ name: cat.name, color: cat.color || 'amber' })
    }

    const close = () => {
        setEditing(null)
        setForm({ name: '', color: 'amber' })
    }

    const handleSave = async () => {
        const name = form.name.trim()
        if (!name) return
        setSaving(true)
        try {
            if (editing === 'new') {
                await createCategory({ name, color: form.color, order: categories.length })
            } else {
                await updateCategory(editing, { name, color: form.color })
            }
            close()
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este grupo? Los productos quedarán sin grupo asignado.')) return
        try {
            await deleteCategory(id)
        } catch (err) {
            console.error(err)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-4">

            <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-sm">🏷️ Gestión de Grupos</h2>
                <button onClick={openNew} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all">
                    ➕ Nuevo Grupo
                </button>
            </div>

            {categories.length === 0 ? (
                <div className="bg-[#1E293B] rounded-2xl p-6 text-center border border-white/5">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-slate-500 text-sm">No hay grupos creados. Crea el primero.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {categories.map((cat, idx) => {
                        const color = getCategoryColor(cat.color)
                        return (
                            <div key={cat.id} className={`${color.bg} ${color.border} rounded-2xl px-4 py-3 flex items-center justify-between border`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full ${color.swatch} border border-white/10`} />
                                    <div>
                                        <p className="text-white font-semibold text-sm">{cat.name}</p>
                                        <p className={`text-xs ${color.text}`}>{cat.color} · orden {idx + 1}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEdit(cat)}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 transition-colors"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal de edición */}
            {editing !== null && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={close}>
                    <div
                        className="bg-[#1E293B] rounded-[24px] w-full max-w-md p-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold text-white mb-5">
                            {editing === 'new' ? '➕ Nuevo Grupo' : '✏️ Editar Grupo'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="label-xs">Nombre del Grupo</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    className="input-field mt-1"
                                    placeholder="ej. Snacks"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="label-xs">Color</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {CATEGORY_COLORS.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setForm(p => ({ ...p, color: c.id }))}
                                            className={`w-8 h-8 rounded-full transition-all ${c.swatch} border-2 ${form.color === c.id ? 'border-white scale-110' : 'border-white/20 hover:scale-105'}`}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={close} className="btn-secondary flex-1">Cancelar</button>
                                <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
