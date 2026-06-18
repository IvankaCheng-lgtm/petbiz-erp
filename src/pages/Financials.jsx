import { useState, useMemo, useRef } from 'react'
import { Plus, Trash2, CheckCircle, Circle, Filter, Sparkles, X, Download } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt, EXPENSE_TYPE_COLOR } from '../utils/format'
import { askGemini } from '../services/geminiService'
import { exportToCSV, exportStatementXLSX } from '../utils/exportReport'

// 簡易 Markdown 渲染（支援 ## ### ** * - ）
function MdText({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-gray-800 text-sm mt-3">{line.slice(4)}</h3>
        if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-gray-800 text-base mt-4 border-b border-gray-100 pb-1">{line.slice(3)}</h2>
        if (line.startsWith('# '))   return <h1 key={i} className="font-bold text-gray-900 text-lg mt-4">{line.slice(2)}</h1>
        const isBullet = line.match(/^[-*] /)
        const content  = line.replace(/^[-*] /, '')
        const rendered = (isBullet ? content : line)
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
        return isBullet
          ? <div key={i} className="flex gap-2"><span className="text-orange-400 shrink-0 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: rendered }} /></div>
          : <p key={i} dangerouslySetInnerHTML={{ __html: rendered }} />
      })}
    </div>
  )
}

const CHANNELS = [
  { group: '線上', options: ['電商', '社群'] },
  { group: '線下', options: ['市集', '寄賣點銷售'] },
  { group: '撥款', options: ['平台撥款', 'LINE Pay 撥款'] },
  { group: '其他', options: ['大宗/B2B', '其他營收'] },
]
const CHANNELS_FLAT = CHANNELS.flatMap(g => g.options)
const CATEGORIES    = ['食品', '烘焙', '蛋糕', '用品']
const EXPENSE_TYPES = ['進貨', '人事', '電費', '租金', '耗材', '行銷', '攤位', '場地費', '設備', '運費', '雜項']
const TABS          = ['營收', '支出']
const today         = () => new Date().toISOString().slice(0, 10)

// ── AI 洞察 Modal ─────────────────────────────────────────────
function AiInsightModal({ onClose, revenues, expenses }) {
  const [loading, setLoading] = useState(false)
  const [report,  setReport]  = useState('')
  const [error,   setError]   = useState('')
  const [called,  setCalled]  = useState(false)

  // 自動收集數據
  const stats = useMemo(() => {
    const totalRev = revenues.reduce((s, r) => s + r.amount, 0)
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
    const netProfit  = totalRev - totalExp
    const profitRate = totalRev > 0 ? (netProfit / totalRev * 100).toFixed(1) : 0

    const elecExp  = expenses.filter(e => e.type === '電費').reduce((s, e) => s + e.amount, 0)
    const elecRatio = totalExp > 0 ? (elecExp / totalExp * 100).toFixed(1) : 0

    const mktExp   = expenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
    const mktRatio = totalRev > 0 ? (mktExp / totalRev * 100).toFixed(1) : 0

    const rentExp  = expenses.filter(e => e.type === '租金').reduce((s, e) => s + e.amount, 0)
    const laborExp = expenses.filter(e => e.type === '人事').reduce((s, e) => s + e.amount, 0)
    const purchExp = expenses.filter(e => e.type === '進貨').reduce((s, e) => s + e.amount, 0)

    const ecRev  = revenues.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
    const mktRev = revenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)

    const catBreakdown = ['食品', '烘焙', '蛋糕', '用品'].map(cat => ({
      cat,
      amount: revenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    }))

    return {
      totalRev, totalExp, netProfit, profitRate,
      elecExp, elecRatio, mktExp, mktRatio,
      rentExp, laborExp, purchExp,
      ecRev, mktRev, catBreakdown,
    }
  }, [revenues, expenses])

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    setReport('')
    setCalled(true)

    const context = `
【營收概況】
- 總營收：${fmt(stats.totalRev)}
- 電商通路：${fmt(stats.ecRev)}（佔 ${stats.totalRev > 0 ? (stats.ecRev / stats.totalRev * 100).toFixed(1) : 0}%）
- 市集通路：${fmt(stats.mktRev)}（佔 ${stats.totalRev > 0 ? (stats.mktRev / stats.totalRev * 100).toFixed(1) : 0}%）
- 產品線：${stats.catBreakdown.map(c => `${c.cat} ${fmt(c.amount)}`).join('、')}

【支出概況】
- 總支出：${fmt(stats.totalExp)}
- 進貨成本：${fmt(stats.purchExp)}（佔支出 ${stats.totalExp > 0 ? (stats.purchExp / stats.totalExp * 100).toFixed(1) : 0}%）
- 租金：${fmt(stats.rentExp)}
- 人事：${fmt(stats.laborExp)}
- 電費：${fmt(stats.elecExp)}（佔支出 ${stats.elecRatio}%）
- 行銷費用：${fmt(stats.mktExp)}（佔營收 ${stats.mktRatio}%）

【損益】
- 淨利：${fmt(stats.netProfit)}
- 利潤率：${stats.profitRate}%
`.trim()

    const prompt = `請根據以上「萌獸探險隊」寵物食品品牌的財務數據，完成以下分析：

1. **整體經營診斷**：用 2-3 句話評估目前財務健康狀況。
2. **三條具體利潤優化建議**：每條建議需包含「問題點 → 具體行動 → 預期效益」。
3. **風險提示**：指出一個需要特別注意的財務風險。

請以 Markdown 格式回覆，語氣專業且具體。`

    try {
      const result = await askGemini(prompt, context)
      setReport(result)
    } catch {
      setError('AI 分析失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: '#722927' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">AI 經營洞察</h3>
              <p className="text-xs text-gray-400">由 Gemini 1.5 Flash 驅動</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 數據摘要列 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>總營收 <strong className="text-gray-800">{fmt(stats.totalRev)}</strong></span>
            <span>總支出 <strong className="text-gray-800">{fmt(stats.totalExp)}</strong></span>
            <span>淨利 <strong className={stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}>{fmt(stats.netProfit)}</strong></span>
            <span>利潤率 <strong className={parseFloat(stats.profitRate) >= 25 ? 'text-emerald-600' : 'text-orange-500'}>{stats.profitRate}%</strong></span>
            <span>電費佔支出 <strong className="text-gray-800">{stats.elecRatio}%</strong></span>
            <span>行銷佔營收 <strong className="text-gray-800">{stats.mktRatio}%</strong></span>
          </div>
        </div>

        {/* 內容區 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!called && (
            <div className="text-center py-10 text-gray-400">
              <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">點擊下方按鈕，AI 將分析上方財務數據並提供優化建議。</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#722927', borderTopColor: 'transparent', borderWidth: '3px' }} />
              <p className="text-sm text-gray-500">AI 參謀正在分析您的財務數據...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {report && !loading && (
            <MdText text={report} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-400">數據為系統累計總量，非單月數據</p>
          <div className="flex gap-2">
            {called && !loading && (
              <button onClick={handleAnalyze} disabled={loading}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50">
                <Sparkles size={14} /> 重新分析
              </button>
            )}
            <button onClick={handleAnalyze} disabled={loading}
              className="flex items-center gap-1.5 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#722927' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#5a1f1d')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#722927')}>
              <Sparkles size={15} />
              {loading ? '分析中...' : called ? '再次分析' : '開始分析'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 供應商 Combobox（支援下拉選單 + 自行輸入）────────────────────
function SupplierCombobox({ suppliers, supplierId, customSupplierName, onChange }) {
  const [inputVal, setInputVal] = useState(() => {
    if (supplierId) return suppliers.find(s => s.id === supplierId)?.name || ''
    return customSupplierName || ''
  })
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const filtered = useMemo(() => {
    const kw = inputVal.trim().toLowerCase()
    return kw ? suppliers.filter(s => s.name.toLowerCase().includes(kw)) : suppliers
  }, [suppliers, inputVal])

  function select(s) {
    setInputVal(s.name)
    setOpen(false)
    onChange({ supplierId: s.id, customSupplierName: '' })
  }

  function handleInput(val) {
    setInputVal(val)
    setOpen(true)
    const exact = suppliers.find(s => s.name === val)
    if (exact) onChange({ supplierId: exact.id, customSupplierName: '' })
    else onChange({ supplierId: null, customSupplierName: val })
  }

  function clear() {
    setInputVal('')
    setOpen(false)
    onChange({ supplierId: null, customSupplierName: '' })
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          className={inputCls + ' flex-1'}
          placeholder="選擇清單或直接輸入名稱"
          value={inputVal}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {inputVal && (
          <button type="button" onClick={clear}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto text-sm">
          {filtered.map(s => (
            <li key={s.id}
              onMouseDown={() => select(s)}
              className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between">
              <span className="text-gray-700">{s.name}</span>
              <span className="text-xs text-gray-400">{s.category}</span>
            </li>
          ))}
        </ul>
      )}
      {supplierId && (
        <p className="text-xs text-emerald-600 mt-1">✓ 已連結供應商清單</p>
      )}
      {!supplierId && inputVal.trim() && (
        <p className="text-xs text-gray-400 mt-1">自行輸入，將記錄為自訂名稱</p>
      )}
    </div>
  )
}

// ── 主組件 ────────────────────────────────────────────────────
export default function Financials({ data }) {
  const { revenues, expenses, addRevenue, deleteRevenue, toggleRevenueReported,
          addExpense, deleteExpense, toggleExpenseReported, suppliers = [] } = data

  const marketOrganizers = useMemo(
    () => suppliers.filter(s => s.category === '市集主辦'),
    [suppliers]
  )

  const [tab,            setTab]            = useState('營收')
  const [modal,          setModal]          = useState(null)
  const [detailItem,     setDetailItem]     = useState(null)
  const [page,           setPage]           = useState(1)
  const [onlyUnreported, setOnlyUnreported] = useState(false)
  const [showAI,         setShowAI]         = useState(false)
  const PAGE_SIZE = 10

  // 對帳單月份選擇
  const now = new Date()
  const [stmtMonth, setStmtMonth] = useState(
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  )

  // 可選月份列表
  const availableMonths = useMemo(() => {
    const s = new Set([
      ...revenues.map(r => r.date.slice(0, 7)),
      ...expenses.map(e => e.date.slice(0, 7)),
    ])
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [revenues, expenses])

  function handleExportStatement() {
    exportStatementXLSX({ stmtMonth, revenues, expenses })
  }

  const [revForm, setRevForm] = useState({ date: today(), channel: '電商', category: '食品', amount: '', note: '', supplierId: null, customSupplierName: '' })

  const PAYOUT_CHANNELS = ['平台撥款', 'LINE Pay 撥款']
  const [expForm, setExpForm] = useState({ date: today(), type: '租金', note: '', amount: '', isProductionCost: false, organizerId: '', organizerName: '', supplierId: null, customSupplierName: '' })

  const sortedRevenues = useMemo(() => [...revenues].filter(r => !r.isPending).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [revenues])
  const sortedExpenses = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [expenses])

  const baseList = tab === '營收' ? sortedRevenues : sortedExpenses
  const list     = useMemo(
    () => onlyUnreported ? baseList.filter(i => !i.isReported) : baseList,
    [baseList, onlyUnreported]
  )

  const totalPages     = Math.ceil(list.length / PAGE_SIZE)
  const paged          = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const unreportedCount = useMemo(() => baseList.filter(i => !i.isReported).length, [baseList])

  function switchTab(t) { setTab(t); setPage(1); setOnlyUnreported(false) }
  function toggleFilter() { setOnlyUnreported(v => !v); setPage(1) }

  function submitRevenue(e) {
    e.preventDefault()
    if (!revForm.amount) return
    const supplierName = revForm.supplierId
      ? suppliers.find(s => s.id === revForm.supplierId)?.name || ''
      : revForm.customSupplierName.trim()
    const isPayout = PAYOUT_CHANNELS.includes(revForm.channel)
    addRevenue({ ...revForm, amount: parseFloat(revForm.amount), supplierName, category: isPayout ? null : revForm.category })
    setModal(null)
    setRevForm({ date: today(), channel: '電商', category: '食品', amount: '', note: '', supplierId: null, customSupplierName: '' })
  }

  function submitExpense(e) {
    e.preventDefault()
    if (!expForm.amount) return
    const supplierName = expForm.supplierId
      ? suppliers.find(s => s.id === expForm.supplierId)?.name || ''
      : expForm.customSupplierName.trim()
    addExpense({ ...expForm, amount: parseFloat(expForm.amount), supplierName })
    setModal(null)
    setExpForm({ date: today(), type: '租金', note: '', amount: '', isProductionCost: false, organizerId: '', organizerName: '', supplierId: null, customSupplierName: '' })
  }

  const channelColor = {
    '電商': 'orange', '社群': 'orange',
    '市集': 'green',  '寄賣點銷售': 'green',
    '平台撥款': 'blue', 'LINE Pay 撥款': 'blue',
    '大宗/B2B': 'blue', '其他營收': 'gray',
  }
  const catColor     = { '食品': 'orange', '烘焙': 'green', '蛋糕': 'purple', '用品': 'blue' }

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* 頁首 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">收支管理</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {/* 對帳單月份 + 匯出 */}
          <select
            value={stmtMonth}
            onChange={e => setStmtMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
            {availableMonths.length === 0
              ? <option value={stmtMonth}>{stmtMonth}</option>
              : availableMonths.map(m => <option key={m} value={m}>{m}</option>)
            }
          </select>
          <button onClick={handleExportStatement}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Download size={15} /> 匯出對帳單
          </button>
          {/* AI 洞察按鈕 */}
          <button onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#722927' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a1f1d'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#722927'}>
            <Sparkles size={15} /> AI 經營洞察
          </button>
          <button onClick={() => setModal('revenue')} className={btnPrimary + ' flex items-center gap-1 text-sm'}>
            <Plus size={15} /> 新增營收
          </button>
          <button onClick={() => setModal('expense')} className={btnSecondary + ' flex items-center gap-1 text-sm'}>
            <Plus size={15} /> 新增支出
          </button>
        </div>
      </div>

      {/* Tab + 過濾器 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${tab === t ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}（{t === '營收' ? revenues.length : expenses.length}）
            </button>
          ))}
        </div>
        <button onClick={toggleFilter}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${onlyUnreported
              ? 'bg-orange-400 text-white border-orange-400'
              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'}`}>
          <Filter size={14} />
          僅顯示未處理
          {unreportedCount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
              ${onlyUnreported ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'}`}>
              {unreportedCount}
            </span>
          )}
        </button>
      </div>

      {/* 收支清單 */}
      <SectionCard>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 text-left">日期</th>
                {tab === '營收' ? (
                  <>
                    <th className="pb-3 text-left">通路</th>
                    <th className="pb-3 text-left">類別</th>
                    <th className="pb-3 text-left">備註</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 text-left">類型</th>
                    <th className="pb-3 text-left">備註</th>
                  </>
                )}
                <th className="pb-3 text-right">金額</th>
                <th className="pb-3 text-center">已處理</th>
                <th className="pb-3 text-center">刪除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map(item => (
                <tr key={item.id}
                  onClick={() => setDetailItem({ ...item, _tab: tab })}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${!item.isReported ? 'bg-orange-50/30' : ''}`}>
                  <td className="py-3 text-gray-500 whitespace-nowrap">{item.date}</td>
                  {tab === '營收' ? (
                    <>
                      <td className="py-3"><Badge color={channelColor[item.channel]}>{item.channel}</Badge></td>
                      <td className="py-3"><Badge color={catColor[item.category] || 'gray'}>{item.category || '—'}</Badge></td>
                      <td className="py-3 text-gray-500 text-xs max-w-[120px] truncate">{item.note || '—'}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-3"><Badge color={EXPENSE_TYPE_COLOR[item.type] || 'gray'}>{item.type}</Badge></td>
                      <td className="py-3 text-gray-600 max-w-[140px] truncate">{item.note}</td>
                    </>
                  )}
                  <td className="py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{fmt(item.amount)}</td>
                  <td className="py-3 text-center">
                    <button
                      onClick={e => { e.stopPropagation(); tab === '營收' ? toggleRevenueReported(item.id) : toggleExpenseReported(item.id) }}
                      className="text-gray-300 hover:text-emerald-500 transition-colors"
                      title={item.isReported ? '已處理，點擊取消' : '標記為已處理'}>
                      {item.isReported
                        ? <CheckCircle size={18} className="text-emerald-500" />
                        : <Circle size={18} />}
                    </button>
                  </td>
                  <td className="py-3 text-center">
                    <button onClick={e => { e.stopPropagation(); if (!window.confirm(`確定刪除此筆${tab}？`)) return; tab === '營收' ? deleteRevenue(item.id) : deleteExpense(item.id) }}
                      className={btnDanger}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    {onlyUnreported ? '所有項目皆已處理 ✅' : '尚無資料'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">共 {list.length} 筆</span>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                    ${page === p ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* 新增營收 Modal */}
      {modal === 'revenue' && (
        <Modal title="新增營收" size="sm" onClose={() => setModal(null)}>
          <form onSubmit={submitRevenue} className="space-y-4">
            <FormRow label="日期">
              <input type="date" className={inputCls} value={revForm.date}
                onChange={e => setRevForm(p => ({ ...p, date: e.target.value }))} required />
            </FormRow>
            <FormRow label="通路">
              <select className={inputCls} value={revForm.channel}
                onChange={e => setRevForm(p => ({ ...p, channel: e.target.value }))}>
                {CHANNELS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </select>
            </FormRow>
            {!PAYOUT_CHANNELS.includes(revForm.channel) && (
              <FormRow label="商品類別">
                <select className={inputCls} value={revForm.category}
                  onChange={e => setRevForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </FormRow>
            )}
            <FormRow label="金額（元）">
              <input type="number" min="0" className={inputCls} placeholder="0" value={revForm.amount}
                onChange={e => setRevForm(p => ({ ...p, amount: e.target.value }))} required />
            </FormRow>
            <FormRow label="備註（選填）">
              <input type="text" className={inputCls} placeholder="備註說明" value={revForm.note}
                onChange={e => setRevForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <FormRow label="供應商/合作對象（選填）">
              <SupplierCombobox
                suppliers={suppliers}
                supplierId={revForm.supplierId}
                customSupplierName={revForm.customSupplierName}
                onChange={v => setRevForm(p => ({ ...p, ...v }))}
              />
            </FormRow>
            <div className="flex gap-2 pt-2">
              <button type="submit" className={btnPrimary + ' flex-1'}>確認新增</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 新增支出 Modal */}
      {modal === 'expense' && (
        <Modal title="新增支出" size="sm" onClose={() => setModal(null)}>
          <form onSubmit={submitExpense} className="space-y-4">
            <FormRow label="日期">
              <input type="date" className={inputCls} value={expForm.date}
                onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))} required />
            </FormRow>
            <FormRow label="費用類型">
              <select className={inputCls} value={expForm.type}
                onChange={e => setExpForm(p => ({ ...p, type: e.target.value, organizerId: '', organizerName: '' }))}>
                {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormRow>
            {(expForm.type === '攤位' || expForm.type === '場地費') && (
              <FormRow label="市集主辦（選填）">
                <select
                  className={inputCls}
                  value={expForm.organizerId}
                  onChange={e => {
                    const s = marketOrganizers.find(x => x.id === e.target.value)
                    setExpForm(p => ({ ...p, organizerId: e.target.value, organizerName: s?.name || '' }))
                  }}
                >
                  <option value="">— 不指定 —</option>
                  {marketOrganizers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {marketOrganizers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">請先在「供應商管理」新增類別為「市集主辦」的供應商</p>
                )}
              </FormRow>
            )}
            <FormRow label="備註">
              <input type="text" className={inputCls} placeholder="費用說明" value={expForm.note}
                onChange={e => setExpForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <FormRow label="金額（元）">
              <input type="number" min="0" className={inputCls} placeholder="0" value={expForm.amount}
                onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))} required />
            </FormRow>
            <FormRow label="供應商/合作對象（選填）">
              <SupplierCombobox
                suppliers={suppliers}
                supplierId={expForm.supplierId}
                customSupplierName={expForm.customSupplierName}
                onChange={v => setExpForm(p => ({ ...p, ...v }))}
              />
            </FormRow>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={expForm.isProductionCost}
                onChange={e => setExpForm(p => ({ ...p, isProductionCost: e.target.checked }))}
                className="accent-orange-400" />
              計入生產成本
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className={btnPrimary + ' flex-1'}>確認新增</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 明細 Modal */}
      {detailItem && (
        <Modal title={detailItem._tab === '營收' ? '營收明細' : '支出明細'} size="sm" onClose={() => setDetailItem(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">日期</p>
                <p className="font-semibold text-gray-800">{detailItem.date}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">金額</p>
                <p className="font-bold text-lg text-gray-800">{fmt(detailItem.amount)}</p>
              </div>
            </div>

            {detailItem._tab === '營收' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">通路</p>
                    <Badge color={channelColor[detailItem.channel]}>{detailItem.channel}</Badge>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">類別</p>
                    {detailItem.category
                      ? <Badge color={catColor[detailItem.category]}>{detailItem.category}</Badge>
                      : <span className="text-xs text-gray-400">撥款，無商品類別</span>}
                  </div>
                </div>
                {detailItem.items?.length > 0 && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-2">商品明細</p>
                    <div className="space-y-1">
                      {detailItem.items.map((it, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span>{it.itemName} × {it.qty}</span>
                          <span>{fmt(it.qty * it.unitPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 mb-1">費用類型</p>
                  <Badge color={EXPENSE_TYPE_COLOR[detailItem.type] || 'gray'}>{detailItem.type}</Badge>
                </div>
                {detailItem.isProductionCost && (
                  <div className="bg-orange-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-orange-400 mb-1">標記</p>
                    <p className="text-xs font-semibold text-orange-600">計入生產成本</p>
                  </div>
                )}
              </div>
            )}

            {detailItem.note && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">備註</p>
                <p className="text-gray-700">{detailItem.note}</p>
              </div>
            )}

            {(detailItem.supplierName || detailItem.customSupplierName) && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">供應商／合作對象</p>
                <p className="text-gray-700">{detailItem.supplierName || detailItem.customSupplierName}</p>
              </div>
            )}

            {detailItem.paymentMethod && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">付款方式</p>
                <p className="text-gray-700">{detailItem.paymentMethod}</p>
              </div>
            )}

            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">處理狀態</p>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                detailItem.isReported ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
              }`}>
                {detailItem.isReported ? '✅ 已處理' : '⏳ 未處理'}
              </span>
            </div>

            <button onClick={() => setDetailItem(null)} className={btnSecondary + ' w-full'}>關閉</button>
          </div>
        </Modal>
      )}

      {/* AI 洞察 Modal */}
      {showAI && (
        <AiInsightModal
          onClose={() => setShowAI(false)}
          revenues={revenues}
          expenses={expenses}
        />
      )}
    </div>
  )
}
