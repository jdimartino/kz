// src/pages/AdminPage.jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSession } from '../context/SessionContext'
import { useNav } from '../context/NavigationContext'
import LogoIcon from '../components/LogoIcon'
import ProductList from '../components/admin/ProductList'
import SessionPanel from '../components/admin/SessionPanel'
import CategoryPanel from '../components/admin/CategoryPanel'
import ReportPage from './ReportPage'
import HistoricalReportPage from './HistoricalReportPage'
import AddressBookPage from './AddressBookPage'

const TABS = [
    { id: 'products', label: '📦 Productos' },
    { id: 'categories', label: '🏷️ Grupos' },
    { id: 'clients', label: '👥 Clientes' },
    { id: 'caja', label: '🏪 Caja' },
    { id: 'report', label: '📊 Reporte Hoy' },
    { id: 'historical', label: '📋 Reporte Histórico' },
]

export default function AdminPage() {
    const { role } = useAuth()
    const { session } = useSession()
    const { setScreen, adminTab, setAdminTab } = useNav()
    const [activeTab, setActiveTab] = useState(adminTab || 'products')
    const [showPosPrompt, setShowPosPrompt] = useState(false)

    const handleTabChange = (tabId) => {
        setActiveTab(tabId)
        setAdminTab(tabId)
    }

    if (role !== 'admin') return null

    return (
        <div className="min-h-screen bg-[#1E1040] flex flex-col">
            {/* Header */}
            <header className="bg-[#2E1B5C] border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <LogoIcon className="w-7 h-7" />
                    <div>
                         <p className="text-white font-bold text-sm leading-none">La KZ Admin</p>
                        <p className="text-slate-400 text-[11px] leading-none mt-0.5 font-semibold">By JDM</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {session?.status === 'open' ? (
                        <button
                            onClick={() => setScreen('pos')}
                            className="text-sm font-bold px-4 py-2.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                        >
                            🏠 POS
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowPosPrompt(true)}
                            className="text-sm font-bold px-4 py-2.5 rounded-xl bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors"
                        >
                            🏠 POS
                        </button>
                    )}
                </div>
            </header>

            {/* Banner: caja cerrada */}
            {session?.status !== 'open' && (
                <div className="px-4 pt-3">
                    <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <div className="flex-1">
                            <p className="text-amber-400 font-bold text-sm">Caja cerrada</p>
                            <p className="text-slate-400 text-xs mt-0.5">Abre la caja para poder facturar.</p>
                        </div>
                        <button
                            onClick={() => handleTabChange('caja')}
                            className="text-xs font-bold px-3 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors shrink-0"
                        >
                            Abrir
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="px-4 pt-4">
                <div className="flex gap-1 bg-[#2E1B5C] rounded-2xl p-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex-1 text-xs font-bold py-2 px-2 rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 p-4 overflow-auto">
                {activeTab === 'products' && <ProductList />}
                {activeTab === 'categories' && <CategoryPanel />}
                {activeTab === 'clients' && <AddressBookPage />}
                {activeTab === 'caja' && <SessionPanel onSessionOpen={() => setScreen('pos')} />}
                {activeTab === 'report' && <ReportPage onBack={() => handleTabChange('caja')} />}
                {activeTab === 'historical' && <HistoricalReportPage />}
            </main>

            {/* Modal: POS sin caja abierta */}
            {showPosPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="bg-[#1E293B] rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl text-center space-y-4">
                        <div className="text-4xl">🏪</div>
                        <h3 className="text-white font-bold text-lg">Caja cerrada</h3>
                        <p className="text-slate-400 text-sm">Abre la caja del día para poder facturar desde POS.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPosPrompt(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setShowPosPrompt(false); handleTabChange('caja') }}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm"
                            >
                                Ir a abrir caja
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
