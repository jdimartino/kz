// src/utils/money.js — La KZ POS — by #JDMRules
// Todas las operaciones en USD con 2 decimales

export const toUSD = (amount) => Number(Number(amount).toFixed(2))
export const formatUSD = (amount) => `$${Number(amount).toFixed(2)}`

// Conversión usando tasa BCV
export const usdToBs = (usd, rate) => Number((Number(usd) * Number(rate)).toFixed(2))
export const bsToUsd = (bs, rate) => Number((Number(bs) / Number(rate)).toFixed(2))
export const formatBs = (bs) => `Bs ${Number(bs).toFixed(2)}`

// Conversión a/desde céntimos
export const toCents = (amount) => Math.round(Number(amount) * 100)
export const fromCents = (cents) => Number(cents) / 100

// Cambio (para pagos)
export const calcChange = (paid, total) => Math.max(0, Number(paid) - Number(total))
