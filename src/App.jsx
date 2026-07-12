// src/App.jsx
import { AuthProvider } from './context/AuthContext'
import { SessionProvider } from './context/SessionContext'
import { CartProvider } from './context/CartContext'
import { NavigationProvider, useNav } from './context/NavigationContext'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import POSPage from './pages/POSPage'
import TicketPage from './pages/TicketPage'
import SuccessPage from './pages/SuccessPage'
import AdminPage from './pages/AdminPage'
import HoldPage from './pages/HoldPage'

function AppRouter() {
    const { screen } = useNav()
    if (screen === 'ticket') return <TicketPage />
    if (screen === 'success') return <SuccessPage />
    if (screen === 'hold') return <HoldPage />
    if (screen === 'admin') return <AdminPage />
    return <POSPage />
}

export default function App() {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <AuthProvider>
                    <SessionProvider>
                        <CartProvider>
                            <NavigationProvider>
                                <AppRouter />
                            </NavigationProvider>
                        </CartProvider>
                    </SessionProvider>
                </AuthProvider>
            </ToastProvider>
        </ErrorBoundary>
    )
}
