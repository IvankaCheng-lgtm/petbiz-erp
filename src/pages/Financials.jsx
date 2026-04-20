import { useState, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, Circle, Filter, Sparkles, X, Download } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt, EXPENSE_TYPE_COLOR } from '../utils/format'
import { askGemini } from '../services/geminiService'
import { exportToCSV } from '../utils/exportReport'

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

const CHANNELS      = ['電商', '市集']
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
    const mRevs = revenues.filter(r => r.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
    const mExps = expenses.filter(e => e.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
    const totalRev = mRevs.reduce((s, r) => s + r.amount, 0)
    const totalExp = mExps.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRev - totalExp
    const [y, m] = stmtMonth.split('-')
    const label = y + '年' + parseInt(m) + '月'

    const rows = [
      ['萌獸探險隊 ' + label + ' 收支對帳單'],
      ['產出日期：' + new Date().toLocaleDateString('zh-TW')],
      [],
      // 營收明細
      ['《營收明細》'],
      ['日期', '通路', '類別', '金額', '報稅狀態'],
      ...mRevs.map(r => [r.date, r.channel || '', r.category || '', r.amount, r.isReported ? '已報稅' : '未報稅']),
      ['營收小計', '', '', totalRev, ''],
      [],
      // 支出明細
      ['《支出明細》'],
      ['日期', '類型', '備註', '金額', '報稅狀態'],
      ...mExps.map(e => [e.date, e.type || '', e.note || '', e.amount, e.isReported ? '已報稅' : '未報稅']),
      ['支出小計', '', '', totalExp, ''],
      [],
      // 損益摘要
      ['《損益摘要》'],
      ['項目', '金額'],
      ['總營收', totalRev],
      ['總支出', totalExp],
      ['淨利', netProfit],
      ['利潤率', totalRev > 0 ? (netProfit / totalRev * 100).toFixed(1) + '%' : '0.0%'],
    ]
    exportToCSV(rows, '萌獸探險隊_對帳單_' + stmtMonth + '.csv')
  }

  const [revForm, setRevForm] = useState({ date: today(), channel: '電商', category: '食品', amount: '' })
  const [expForm, setExpForm] = useState({ date: today(), type: '租金', note: '', amount: '', isProductionCost: false, organizerId: '', organizerName: '' })

  const sortedRevenues = useMemo(() => [...revenues].sort((a, b) => b.date.localeCompare(a.date)), [revenues])
  const sortedExpenses = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses])

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
    addRevenue({ ...revForm, amount: parseFloat(revForm.amount) })
    setModal(null)
    setRevForm({ date: today(), channel: '電商', category: '食品', amount: '' })
  }

  function submitExpense(e) {
    e.preventDefault()
    if (!expForm.amount) return
    addExpense({ ...expForm, amount: parseFloat(expForm.amount) })
    setModal(null)
    setExpForm({ date: today(), type: '租金', note: '', amount: '', isProductionCost: false, organizerId: '', organizerName: '' })
  }

  const channelColor = { '電商': 'orange', '市集': 'green' }
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
          僅顯示未報稅
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
                  </>
                ) : (
                  <>
                    <th className="pb-3 text-left">類型</th>
                    <th className="pb-3 text-left">備註</th>
                  </>
                )}
                <th className="pb-3 text-right">金額</th>
                <th className="pb-3 text-center">已報稅</th>
                <th className="pb-3 text-center">刪除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map(item => (
                <tr key={item.id}
                  className={`hover:bg-gray-50 transition-colors ${!item.isReported ? 'bg-orange-50/30' : ''}`}>
                  <td className="py-3 text-gray-500 whitespace-nowrap">{item.date}</td>
                  {tab === '營收' ? (
                    <>
                      <td className="py-3"><Badge color={channelColor[item.channel]}>{item.channel}</Badge></td>
                      <td className="py-3"><Badge color={catColor[item.category]}>{item.category}</Badge></td>
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
                      onClick={() => tab === '營收' ? toggleRevenueReported(item.id) : toggleExpenseReported(item.id)}
                      className="text-gray-300 hover:text-emerald-500 transition-colors"
                      title={item.isReported ? '已報稅，點擊取消' : '標記為已報稅'}>
                      {item.isReported
                        ? <CheckCircle size={18} className="text-emerald-500" />
                        : <Circle size={18} />}
                    </button>
                  </td>
                  <td className="py-3 text-center">
                    <button onClick={() => tab === '營收' ? deleteRevenue(item.id) : deleteExpense(item.id)}
                      className={btnDanger}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    {onlyUnreported ? '所有項目皆已報稅 ✅' : '尚無資料'}
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
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormRow>
            <FormRow label="商品類別">
              <select className={inputCls} value={revForm.category}
                onChange={e => setRevForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormRow>
            <FormRow label="金額（元）">
              <input type="number" min="0" className={inputCls} placeholder="0" value={revForm.amount}
                onChange={e => setRevForm(p => ({ ...p, amount: e.target.value }))} required />
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
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
