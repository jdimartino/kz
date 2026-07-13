// src/context/AuthContext.jsx — La KZ POS — by #JDMRules
// Usuario único hardcodeado "admin" — sin Firebase Auth
import { createContext } from 'react'

export const DEFAULT_USER = { uid: 'admin', role: 'admin', email: 'admin@lakz.app' }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    return children
}

export const useAuth = () => {
    return { user: DEFAULT_USER, role: 'admin', loading: false }
}
