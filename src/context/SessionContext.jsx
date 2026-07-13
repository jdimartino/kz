// src/context/SessionContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'

const SessionContext = createContext(null)
const LS_KEY = 'lakz_session'

export function SessionProvider({ children }) {
    const [session, setSessionState] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_KEY)
            return saved ? JSON.parse(saved) : null
        } catch { return null }
    })

    const setSession = (s) => {
        setSessionState(s)
        if (s) localStorage.setItem(LS_KEY, JSON.stringify(s))
        else localStorage.removeItem(LS_KEY)
    }

    // Sincronizar sesión desde Firestore en tiempo real (multi-dispositivo)
    useEffect(() => {
        const q = query(
            collection(db, 'sessions'),
            where('status', '==', 'open'),
            orderBy('openedAt', 'desc'),
            limit(1)
        )
        const unsub = onSnapshot(q, (snap) => {
            if (snap.empty) {
                // No hay sesión abierta en Firestore → limpiar
                if (localStorage.getItem(LS_KEY)) {
                    localStorage.removeItem(LS_KEY)
                    setSessionState(null)
                }
                return
            }
            const doc = snap.docs[0]
            const remoteSession = { id: doc.id, ...doc.data() }
            const local = localStorage.getItem(LS_KEY)
            const localParsed = local ? JSON.parse(local) : null
            // Solo actualizar si cambió (evita re-renders innecesarios)
            if (!localParsed || localParsed.id !== remoteSession.id || localParsed.exchangeRate !== remoteSession.exchangeRate) {
                localStorage.setItem(LS_KEY, JSON.stringify(remoteSession))
                setSessionState(remoteSession)
            }
        }, (err) => {
            console.error('Error escuchando sesión:', err)
        })
        return unsub
    }, [])

    return (
        <SessionContext.Provider value={{ session, setSession }}>
            {children}
        </SessionContext.Provider>
    )
}

export const useSession = () => useContext(SessionContext)
