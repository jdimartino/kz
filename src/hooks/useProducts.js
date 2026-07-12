// src/hooks/useProducts.js
import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

export function useProducts() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(collection(db, 'products'), orderBy('category'), orderBy('name'))
        const unsub = onSnapshot(q, (snap) => {
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
        })
        return unsub
    }, [])

    return { products, loading }
}
