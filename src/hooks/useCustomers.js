// src/hooks/useCustomers.js
import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useCustomers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = collection(db, 'customers')
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                list.sort((a, b) => {
                    const ta = a.lastVisit?.seconds || 0
                    const tb = b.lastVisit?.seconds || 0
                    return tb - ta
                })
                setCustomers(list)
                setLoading(false)
            },
            (err) => {
                console.error('useCustomers error:', err)
                setLoading(false)
            }
        )
        return unsub
    }, [])

    return { customers, loading }
}
