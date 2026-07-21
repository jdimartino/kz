// src/hooks/useAllCustomers.js
import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export function useAllCustomers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(collection(db, 'customers'), orderBy('name', 'asc'))
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                setCustomers(list)
                setLoading(false)
            },
            (err) => {
                console.error('useAllCustomers error:', err)
                setLoading(false)
            }
        )
        return unsub
    }, [])

    return { customers, loading }
}
