// src/hooks/useOpenOrders.js
// Escucha en tiempo real TODAS las órdenes con status 'open', sin importar la sesión.
// Así las cuentas en espera nunca desaparecen al abrir/cerrar caja.
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export function useOpenOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(
            collection(db, 'orders'),
            where('status', '==', 'open')
        )
        const unsub = onSnapshot(q, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            setOrders(docs)
            setLoading(false)
        })
        return unsub
    }, [])

    return { orders, loading }
}
