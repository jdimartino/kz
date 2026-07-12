// src/hooks/useCategories.js
import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export function useCategories() {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(collection(db, 'categories'), orderBy('order'))
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                setCategories(list)
                setLoading(false)
            },
            (err) => {
                console.error('useCategories error:', err)
                setLoading(false)
            }
        )
        return unsub
    }, [])

    return { categories, loading }
}
