// src/hooks/useHistoricalReport.js
// Consulta órdenes pagadas por rango de fechas o por sesión específica
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function useHistoricalReport({ mode, dateFrom, dateTo, sessionId }) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(false)
    const [productTotals, setProductTotals] = useState([])

    useEffect(() => {
        let q

        if (mode === 'session') {
            if (!sessionId) {
                setOrders([])
                setProductTotals([])
                setLoading(false)
                return
            }
            q = query(
                collection(db, 'orders'),
                where('sessionId', '==', sessionId),
                where('status', '==', 'paid'),
                orderBy('createdAt', 'desc')
            )
        } else {
            if (!dateFrom || !dateTo) {
                setOrders([])
                setProductTotals([])
                setLoading(false)
                return
            }
            const startTs = Timestamp.fromDate(new Date(dateFrom + 'T00:00:00'))
            const endTs = Timestamp.fromDate(new Date(dateTo + 'T23:59:59'))
            q = query(
                collection(db, 'orders'),
                where('status', '==', 'paid'),
                where('createdAt', '>=', startTs),
                where('createdAt', '<=', endTs),
                orderBy('createdAt', 'desc')
            )
        }
        setLoading(true)

        getDocs(q)
            .then(async (snap) => {
                const rawOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))

                const enriched = await Promise.all(rawOrders.map(async (o) => {
                    const needsSubcol = !o.paymentMethod || o.paymentMethod === 'mixed'
                    if (!needsSubcol) return { ...o, paymentData: null }
                    const paySnap = await getDocs(collection(db, 'orders', o.id, 'payments'))
                    const payData = paySnap.docs[0]?.data()
                    return { ...o, paymentMethod: o.paymentMethod || payData?.method, paymentData: payData }
                }))

                setOrders(enriched)

                // Leer items de todas las órdenes y agregar por producto
                const totalsMap = {}
                await Promise.all(rawOrders.map(async (o) => {
                    const itemsSnap = await getDocs(collection(db, 'orders', o.id, 'items'))
                    itemsSnap.docs.forEach(d => {
                        const item = d.data()
                        const id = d.id
                        if (!totalsMap[id]) totalsMap[id] = { name: item.name, emoji: item.emoji, qty: 0, totalUSD: 0 }
                        totalsMap[id].qty += item.qty
                        totalsMap[id].totalUSD += Number(item.subtotalUSD)
                    })
                }))

                const sorted = Object.entries(totalsMap)
                    .map(([id, val]) => ({ id, ...val }))
                    .sort((a, b) => b.totalUSD - a.totalUSD)

                setProductTotals(sorted)
                setLoading(false)
            })
            .catch(err => {
                console.error('Historical report error:', err)
                setLoading(false)
            })
    }, [mode, dateFrom, dateTo, sessionId])

    const totalUSD = orders.reduce((s, o) => s + (o.totalUSD || 0), 0)
    const totalTx = orders.length

    return { orders, loading, totalUSD, totalTx, productTotals }
}
