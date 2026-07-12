// src/hooks/useCustomers.js
import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'

export function useCustomers(max = 50) {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(collection(db, 'customers'), orderBy('lastVisit', 'desc'), limit(max))
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                setCustomers(list)
                setLoading(false)
            },
            (err) => {
                console.error('useCustomers error:', err)
                setLoading(false)
            }
        )
        return unsub
    }, [max])

    return { customers, loading }
}
