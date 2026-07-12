// src/context/NavigationContext.jsx
// Router mínimo sin react-router (SPA de 3 pantallas)
import { createContext, useContext, useState } from 'react'

const NavContext = createContext(null)

// screens: 'pos' | 'ticket' | 'success' | 'hold' | 'admin'
export function NavigationProvider({ children }) {
    const [screen, setScreen] = useState('pos')
    const [adminTab, setAdminTab] = useState('products')
    const [lastOrderId, setOrderId] = useState(null)
    const [lastOrderData, setLastOrderData] = useState(null)
    const [holdOrderId, setHoldOrderId] = useState(null)

    return (
        <NavContext.Provider value={{ screen, setScreen, adminTab, setAdminTab, lastOrderId, setOrderId, lastOrderData, setLastOrderData, holdOrderId, setHoldOrderId }}>
            {children}
        </NavContext.Provider>
    )
}

export const useNav = () => useContext(NavContext)
