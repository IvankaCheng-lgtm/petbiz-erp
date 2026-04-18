import { useState, useMemo } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import usePetBusiness from './hooks/usePetBusiness'
import useAuth from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard   from './pages/Dashboard'
import Financials  from './pages/Financials'
import Procurement from './pages/Procurement'
import Production  from './pages/Production'
import PnL         from './pages/PnL'
import Performance from './pages/Performance'
import Settings    from './pages/Settings'
import Nutrition   from './pages/Nutrition'
import { getAccountingReminders } from './utils/accounting'
import logoImg from './assets/LOGO.png'

const NAV_ITEMS = [
  { key: 'dashboard',   label: '營業總覽',   icon: '📊' },
  { key: 'financials',  label: '收支管理',   icon: '💰' },
  { key: 'procurement', label: '進貨與庫存', icon: '📦' },
  { key: 'production',  label: '電費與生產', icon: '⚡' },
  { key: 'pnl',         label: '盈虧損益表', icon: '📑' },
  { key: 'performance', label: '通路表現',   icon: '🏆' },
  { key: 'nutrition',   label: '營養計算室', icon: '🧪' },
  { key: 'settings',   label: '系統設置',   icon: '⚙️' },
]

export default function App() {
  const [activePage, setActivePage]   = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)   // 桌面版
  const [mobileOpen, setMobileOpen]   = useState(false)  // 手機版 overlay

  const bizData   = usePetBusiness()
  const auth      = useAuth()
  const { currentUser, logout } = auth
  const reminders = useMemo(() => getAccountingReminders(), [])

  const unreportedTotal = useMemo(
    () => bizData.revenues.filter(r => !r.isReported).length
        + bizData.expenses.filter(e => !e.isReported).length,
    [bizData.revenues, bizData.expenses]
  )

  const PAGE_MAP = {
    dashboard:   <Dashboard   data={bizData} />,
    financials:  <Financials  data={bizData} />,
    procurement: <Procurement data={bizData} />,
    production:  <Production  data={bizData} />,
    pnl:         <PnL         data={bizData} />,
    performance: <Performance data={bizData} />,
    nutrition:   <Nutrition   data={bizData} />,
    settings:    <Settings    data={{ ...bizData, auth }} />,
  }

  // 未登入則顯示登入頁（必須在所有 hooks 之後）
  if (!currentUser) return <Login onLogin={auth.login} />

  function navigate(key) {
    setActivePage(key)
    setMobileOpen(false)
  }

  const SidebarContent = ({ expanded }) => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-center px-4 border-b border-white/20" style={{ minHeight: '68px' }}>
        <img
          src={logoImg}
          alt="萌獸探險隊"
          style={{
            height: '40px',
            maxWidth: expanded ? '140px' : '36px',
            width: '100%',
            objectFit: 'contain',
            transition: 'max-width 0.3s',
          }}
        />
      </div>

      {/* 警示徽章區 */}
      {expanded && (bizData.inventoryAlerts.length > 0 || reminders.length > 0 || unreportedTotal > 0) && (
        <div className="mx-3 mt-3 space-y-1.5">
          {bizData.inventoryAlerts.length > 0 && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs text-red-300 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{bizData.inventoryAlerts.length} 項庫存警示</span>
            </div>
          )}
          {reminders.length > 0 && (
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg px-3 py-1.5 text-xs text-orange-300 flex items-center gap-1.5">
              <span>🧾</span>
              <span>{reminders.length} 項會計待辦</span>
            </div>
          )}
          {unreportedTotal > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-3 py-1.5 text-xs text-yellow-300 flex items-center gap-1.5">
              <span>📋</span>
              <span>{unreportedTotal} 筆未報稅</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ key, label, icon }) => {
          // 收支管理顯示未報稅數量
          const badge = key === 'financials' && unreportedTotal > 0 ? unreportedTotal : null
          return (
            <button key={key} onClick={() => navigate(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors
                ${activePage === key
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-lg shrink-0">{icon}</span>
              {expanded && (
                <span className="flex-1 truncate text-left">{label}</span>
              )}
              {expanded && badge && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">

      {/* ── 桌面版側邊欄 ── */}
      <aside className={`hidden md:flex flex-col text-white transition-all duration-300 shrink-0
        ${sidebarOpen ? 'w-56' : 'w-16'}`} style={{ backgroundColor: '#722927' }}>
        <SidebarContent expanded={sidebarOpen} />
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="px-4 py-3 text-white/60 hover:text-white hover:bg-white/10 border-t border-white/20 text-sm transition-colors">
          {sidebarOpen ? '◀ 收合' : '▶'}
        </button>
        {/* 登出區塊 - 桌面版 */}
        {sidebarOpen && (
          <div className="px-4 py-2.5 border-t border-white/20 flex items-center justify-between">
            <span className="text-xs text-white/60 truncate">{currentUser?.username}</span>
            <button onClick={logout}
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors shrink-0 ml-2">
              <LogOut size={13} /> 登出
            </button>
          </div>
        )}
      </aside>

      {/* ── 手機版 Overlay 側邊欄 ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          {/* 側邊欄 */}
          <aside className="absolute left-0 top-0 h-full w-64 text-white flex flex-col z-50" style={{ backgroundColor: '#722927' }}>
            <SidebarContent expanded={true} />
            {/* 登出區塊 - 手機版 */}
            <div className="px-4 py-2.5 border-t border-white/20 flex items-center justify-between">
              <span className="text-xs text-white/60">{currentUser?.username}</span>
              <button onClick={logout}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors">
                <LogOut size={13} /> 登出
              </button>
            </div>
            <button onClick={() => setMobileOpen(false)}
              className="px-4 py-3 text-white/60 hover:text-white hover:bg-white/10 border-t border-white/20 text-sm transition-colors flex items-center gap-2">
              <X size={16} /> 關閉選單
            </button>
          </aside>
        </div>
      )}

      {/* ── 主內容區 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 手機版頂部導覽列 */}
        <header className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600 hover:text-gray-900 transition-colors">
            <Menu size={22} />
          </button>
          <img src={logoImg} alt="萌獸探險隊" style={{ height: '28px', objectFit: 'contain' }} />
          <span className="font-bold text-gray-800 text-sm">PetBiz ERP</span>
          {/* 警示點 */}
          <div className="ml-auto flex items-center gap-2">
            {bizData.inventoryAlerts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500" title="庫存警示" />
            )}
            {reminders.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-400" title="會計待辦" />
            )}
            {unreportedTotal > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {unreportedTotal}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {PAGE_MAP[activePage]}
        </main>
      </div>
    </div>
  )
}
