// src/utils/money.js — Los 3 Cochinitos POS
// Todas las operaciones en céntimos de bolívar (×100)

export const toCents = (bs) => Math.round(bs * 100)
export const fromCents = (cents) => cents / 100
export const formatBs = (cents) => `Bs ${fromCents(cents).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const formatBsNum = (amount) => amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const calcChange = (paidCents, totalCents) => Math.max(0, paidCents - totalCents)
