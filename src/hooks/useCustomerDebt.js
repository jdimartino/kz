// src/hooks/useCustomerDebt.js
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export function useCustomerDebt(customerId, customerPhone) {
    const [debt, setDebt] = useState({ totalDebt: 0, totalAbonos: 0, openOrders: [], loading: true })

    useEffect(() => {
        if (!customerPhone) {
            setDebt({ totalDebt: 0, totalAbonos: 0, openOrders: [], loading: false })
            return
        }

        let totalOpen = 0
        let totalAbonos = 0
        let openOrders = []

        const norm = (p) => (p || '').replace(/\D/g, '')
        const phoneDigits = norm(customerPhone)

        const unsubOrders = onSnapshot(
            query(collection(db, 'orders'), where('status', '==', 'open')),
            (snap) => {
                openOrders = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(o => norm(o.client?.phone) === phoneDigits)
                totalOpen = openOrders.reduce((sum, o) => sum + (o.totalUSD || 0), 0)
                setDebt(prev => ({
                    ...prev,
                    totalDebt: totalOpen - totalAbonos,
                    openOrders,
                    loading: false,
                }))
            }
        )

        const unsubAbonos = customerId
            ? onSnapshot(
                query(collection(db, 'abonos'), where('customerId', '==', customerId)),
                (snap) => {
                    totalAbonos = snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0)
                    setDebt(prev => ({
                        ...prev,
                        totalDebt: Math.max(0, totalOpen - totalAbonos),
                        totalAbonos,
                    }))
                }
            )
            : () => {}

        return () => { unsubOrders(); unsubAbonos() }
    }, [customerId, customerPhone])

    return debt
}
