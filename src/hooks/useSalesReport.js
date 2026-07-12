// src/hooks/useSalesReport.js
// Consulta las órdenes de una sesión específica en tiempo real
// Si no hay sessionId, consulta órdenes pagadas del día de hoy
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function useSalesReport(sessionId) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let q

        if (sessionId) {
            q = query(
                collection(db, 'orders'),
                where('sessionId', '==', sessionId),
                where('status', '==', 'paid'),
                orderBy('createdAt', 'desc')
            )
        } else {
            const today = new Date().toISOString().slice(0, 10)
            const startTs = Timestamp.fromDate(new Date(today + 'T00:00:00'))
            const endTs = Timestamp.fromDate(new Date(today + 'T23:59:59'))
            q = query(
                collection(db, 'orders'),
                where('status', '==', 'paid'),
                where('createdAt', '>=', startTs),
                where('createdAt', '<=', endTs),
                orderBy('createdAt', 'desc')
            )
        }

        const unsub = onSnapshot(q, async (snap) => {
            const rawOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))

            const enriched = await Promise.all(rawOrders.map(async (o) => {
                const needsSubcol = !o.paymentMethod || o.paymentMethod === 'mixed'
                if (!needsSubcol) return o
                const paySnap = await getDocs(collection(db, 'orders', o.id, 'payments'))
                const payData = paySnap.docs[0]?.data()
                return { ...o, paymentMethod: o.paymentMethod || payData?.method, paymentData: payData }
            }))

            setOrders(enriched)
            setLoading(false)
        })
        return unsub
    }, [sessionId])

    const totalUSD = orders.reduce((s, o) => s + (o.totalUSD || 0), 0)
    const totalTx = orders.length

    return { orders, loading, totalUSD, totalTx }
}
