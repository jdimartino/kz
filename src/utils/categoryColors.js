// src/utils/categoryColors.js
// Paleta de colores disponibles para categorías/grupos

const CATEGORY_COLORS = [
    { id: 'amber',   label: 'Ámbar',    bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   swatch: 'bg-amber-400' },
    { id: 'orange',  label: 'Naranja',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400',  swatch: 'bg-orange-400' },
    { id: 'red',     label: 'Rojo',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400',     swatch: 'bg-red-400' },
    { id: 'sky',     label: 'Celeste',  bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-400',     swatch: 'bg-sky-400' },
    { id: 'yellow',  label: 'Amarillo', bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  text: 'text-yellow-400',  swatch: 'bg-yellow-400' },
    { id: 'purple',  label: 'Púrpura',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400',  swatch: 'bg-purple-400' },
    { id: 'green',   label: 'Verde',    bg: 'bg-green-500/10',   border: 'border-green-500/20',   text: 'text-green-400',   swatch: 'bg-green-400' },
    { id: 'teal',    label: 'Teal',     bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400',    swatch: 'bg-teal-400' },
    { id: 'pink',    label: 'Rosa',     bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    text: 'text-pink-400',    swatch: 'bg-pink-400' },
    { id: 'indigo',  label: 'Índigo',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  text: 'text-indigo-400',  swatch: 'bg-indigo-400' },
    { id: 'lime',    label: 'Lima',     bg: 'bg-lime-500/10',    border: 'border-lime-500/20',    text: 'text-lime-400',    swatch: 'bg-lime-400' },
    { id: 'emerald', label: 'Esmeralda',bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', swatch: 'bg-emerald-400' },
]

export function getCategoryColor(colorId) {
    return CATEGORY_COLORS.find(c => c.id === colorId) || CATEGORY_COLORS[0]
}

export default CATEGORY_COLORS
