// src/hooks/useSessions.js
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useSessions() {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const q = query(
            collection(db, 'sessions'),
            where('status', '==', 'closed'),
            orderBy('openedAt', 'desc')
        )

        const unsub = onSnapshot(q, (snap) => {
            const sessionList = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }))
            setSessions(sessionList)
            setLoading(false)
        }, (err) => {
            console.error('Error fetching sessions:', err)
            setLoading(false)
        })

        return unsub
    }, [])

    return { sessions, loading }
}
