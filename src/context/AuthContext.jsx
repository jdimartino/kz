// src/context/AuthContext.jsx — Los 3 Cochinitos POS
// Usuario único hardcodeado "admin" — sin Firebase Auth
import { createContext } from 'react'

export const DEFAULT_USER = { uid: 'admin', role: 'admin', email: 'admin@cochinitos.app' }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    return children
}

export const useAuth = () => {
    return { user: DEFAULT_USER, role: 'admin', loading: false }
}
