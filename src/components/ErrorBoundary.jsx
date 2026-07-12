// src/components/ErrorBoundary.jsx
import { Component } from 'react'
import LogoIcon from './LogoIcon'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
                    <div className="flex justify-center mb-4"><LogoIcon className="w-16 h-16" /></div>
                    <h1 className="text-white text-xl font-bold mb-2">Algo salió mal</h1>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm">
                        Ocurrió un error inesperado. Intenta recargar la página.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all"
                    >
                        Recargar Página
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}
