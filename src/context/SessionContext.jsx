// src/context/SessionContext.jsx
import { createContext, useContext, useState } from 'react'

const SessionContext = createContext(null)
const LS_KEY = 'cochinitos_session'

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

    return (
        <SessionContext.Provider value={{ session, setSession }}>
            {children}
        </SessionContext.Provider>
    )
}

export const useSession = () => useContext(SessionContext)
