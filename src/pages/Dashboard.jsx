import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Store } from 'lucide-react'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Sparkles, AlertTriangle, Bell, ClipboardList } from 'lucide-react'
import { KpiCard, SectionCard, btnPrimary } from '../components/ui'
import { fmt, buildMonthlyTrend } from '../utils/format'
import { getAccountingReminders } from '../utils/accounting'
import AIAccountingAssistant from '../components/AIAccountingAssistant'
import InventoryAI from '../components/InventoryAI'
import { askGemini } from '../services/geminiService'

const FILTERS = ['月', '季', '年']

function PendingPayoutBanner({ linepayPending }) {
  const [open, setOpen] = useState(false)
  const hasAny = linepayPending.mktCount > 0 || linepayPending.orderLinePayCount > 0 || linepayPending.ecCount > 0
  if (!hasAny) return null
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-green-100/50 transition-colors">
        <span className="text-base">💚</span>
        <span className="text-sm font-semibold text-green-800">待撥款提示（尚未入帳）</span>
        <span className="ml-auto text-lg font-black text-green-700">{fmt(linepayPending.total)}</span>
        <span className="text-green-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2 border-t border-green-200">
          {linepayPending.mktCount > 0 && (
            <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between mt-3">
              <div>
                <p className="text-xs font-semibold text-gray-700">🏪 市集 LINE Pay 待撥款</p>
                <p className="text-xs text-gray-400 mt-0.5">撥款後請在收支管理新增「 LINE Pay 撥款」入帳</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-green-700">{fmt(linepayPending.mktAmount)}</p>
                <p className="text-xs text-gray-400">{linepayPending.mktCount} 筆</p>
              </div>
            </div>
          )}
          {linepayPending.orderLinePayCount > 0 && (
            <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">📱 銷售訂單 LINE Pay 待撥款</p>
                <p className="text-xs text-gray-400 mt-0.5">撥款後請在收支管理新增「 LINE Pay 撥款」入帳</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-green-700">{fmt(linepayPending.orderLinePayAmount)}</p>
                <p className="text-xs text-gray-400">{linepayPending.orderLinePayCount} 筆</p>
              </div>
            </div>
          )}
          {linepayPending.ecCount > 0 && (
            <div className="bg-white rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700">💻 電商平台待撥款</p>
                  <p className="text-xs text-gray-400 mt-0.5">收到撥款後請在收支管理新增「平台撥款」入帳</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-amber-600">{fmt(linepayPending.ecAmount)}</p>
                  <p className="text-xs text-gray-400">{linepayPending.ecCount} 筆</p>
                </div>
              </div>
              <div className="space-y-1">
                {linepayPending.ecItems.map(r => (
                  <div key={r.id} className="flex justify-between text-xs text-gray-500">
                    <span>{r.channel} · {r.date}</span>
                    <span className="font-medium">{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const REMINDER_STYLE = {
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', title: 'text-orange-700', badge: 'bg-orange-100 text-orange-600' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   title: 'text-blue-700',   badge: 'bg-blue-100 text-blue-600'   },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-700', badge: 'bg-purple-100 text-purple-600' },
  green:  { bg: 'bg-emerald-50',border: 'border-emerald-200',title: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-600' },
}

export default function Dashboard({ data }) {
  const { kpi, inventoryAlerts, revenues, expenses, inventory = [], upcomingEvents = [], orders = [], marketSales = [], onDoneRemindersChange } = data
  const [filter, setFilter] = useState('月')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const reminders = useMemo(() => getAccountingReminders(), [])
  const [doneReminders, setDoneReminders] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('petbiz_done_reminders') || '{}')
      const thisMonth = new Date().toISOString().slice(0, 7)
      if (saved.month !== thisMonth) return []
      return saved.ids ?? []
    } catch { return [] }
  })
  function toggleReminder(id) {
    setDoneReminders(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      const thisMonth = new Date().toISOString().slice(0, 7)
      localStorage.setItem('petbiz_done_reminders', JSON.stringify({ month: thisMonth, ids: next }))
      onDoneRemindersChange?.(next)
      return next
    })
  }
  const unreportedRev = useMemo(() => revenues.filter(r => !r.isReported).length, [revenues])
  const unreportedExp = useMemo(() => expenses.filter(e => !e.isReported).length, [expenses])
  const totalUnreported = unreportedRev + unreportedExp

  // 今日銷售訂單統計
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayOrders = useMemo(
    () => orders.filter(o => o.orderDate === todayStr),
    [orders, todayStr]
  )
  const todayOrderRevenue = useMemo(
    () => todayOrders.reduce((s, o) => s + o.total, 0),
    [todayOrders]
  )

  // 待撥款統計：分兩類
  // 1. 電商待撥款：revenues isPending:true（各平台月結）
  // 2. LINE Pay 待撥款：marketSales（市集現場 LINE Pay）
  const linepayPending = useMemo(() => {
    const prefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const pendingRevenues = revenues.filter(r => r.isPending && r.date.startsWith(prefix))
    // 市集 LINE Pay：marketSales 中 channel==='市集'
    const mktSales = marketSales.filter(r => r.date.startsWith(prefix) && r.channel === '市集')
    // 銷售訂單 LINE Pay：marketSales 中 channel!=='市集'（電商訂單 LINE Pay）
    const orderLinePay = marketSales.filter(r => r.date.startsWith(prefix) && r.channel !== '市集')
    // 電商平台待撥款：revenues isPending
    const ecItems = pendingRevenues.filter(r => r.channel !== '市集')
    const mktAmount = mktSales.reduce((s, r) => s + r.amount, 0)
    const orderLinePayAmount = orderLinePay.reduce((s, r) => s + r.amount, 0)
    const ecAmount = ecItems.reduce((s, r) => s + r.amount, 0)
    return {
      total: mktAmount + orderLinePayAmount + ecAmount,
      mktAmount, mktCount: mktSales.length,
      orderLinePayAmount, orderLinePayCount: orderLinePay.length,
      ecAmount, ecCount: ecItems.length, ecItems,
    }
  }, [revenues, marketSales])

  const trend = useMemo(() => buildMonthlyTrend(revenues, expenses), [revenues, expenses])

  // 依 filter 計算 KPI
  const filteredKpi = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const q = Math.ceil(m / 3)

    const filterRev = revenues.filter(r => !r.isPending)
    let revs, exps
    if (filter === '月') {
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      revs = filterRev.filter(r => r.date.startsWith(prefix))
      exps = expenses.filter(e => e.date.startsWith(prefix))
    } else if (filter === '季') {
      const qMonths = [1,2,3].map(i => `${y}-${String((q-1)*3+i).padStart(2,'0')}`)
      revs = filterRev.filter(r => qMonths.some(p => r.date.startsWith(p)))
      exps = expenses.filter(e => qMonths.some(p => e.date.startsWith(p)))
    } else {
      revs = filterRev.filter(r => r.date.startsWith(String(y)))
      exps = expenses.filter(e => e.date.startsWith(String(y)))
    }
    const totalRevenue = revs.reduce((s, r) => s + r.amount, 0)
    const totalExpense = exps.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRevenue - totalExpense
    const profitRate = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    return { totalRevenue, totalExpense, netProfit, profitRate }
  }, [revenues, expenses, filter])

  const filterLabel = filter === '月' ? `${new Date().getFullYear()}年${new Date().getMonth()+1}月` : filter === '季' ? `${new Date().getFullYear()} Q${Math.ceil((new Date().getMonth()+1)/3)}` : `${new Date().getFullYear()}年`

  const chartData = useMemo(() => {
    if (filter === '月') return trend
    if (filter === '季') {
      return ['Q1', 'Q2', 'Q3', 'Q4'].map((q, qi) => {
        const slice = trend.slice(qi * 3, qi * 3 + 3)
        return {
          label: q,
          營收: slice.reduce((s, d) => s + d.營收, 0),
          支出: slice.reduce((s, d) => s + d.支出, 0),
          淨利: slice.reduce((s, d) => s + d.淨利, 0),
        }
      })
    }
    return [trend.reduce((acc, d) => ({
      label: '全年', 營收: acc.營收 + d.營收, 支出: acc.支出 + d.支出, 淨利: acc.淨利 + d.淨利,
    }), { label: '全年', 營收: 0, 支出: 0, 淨利: 0 })]
  }, [trend, filter])

  async function handleAI() {
    setAiLoading(true)
    setAiError('')
    setAiText('')
    try {
      const totalRevenue = kpi.totalRevenue
      const totalExpense = kpi.totalExpense
      const ecRev  = revenues.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
      const mktRev = revenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)
      const mktExp = expenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
      const rentExp = expenses.filter(e => e.type === '租金').reduce((s, e) => s + e.amount, 0)
      const laborExp = expenses.filter(e => e.type === '人事').reduce((s, e) => s + e.amount, 0)
      const alertNames = inventoryAlerts.map(i => i.itemName).join('、')

      const context = `「萌獸探險隊」寵物食品品牌營運數據：
- 總營收：${totalRevenue.toLocaleString()} 元，總支出：${totalExpense.toLocaleString()} 元
- 淨利：${kpi.netProfit.toLocaleString()} 元，利潤率：${kpi.profitRate.toFixed(1)}%
- 電商營收：${ecRev.toLocaleString()} 元，市集營收：${mktRev.toLocaleString()} 元
- 行銷費用：${mktExp.toLocaleString()} 元，租金：${rentExp.toLocaleString()} 元，人事：${laborExp.toLocaleString()} 元
${alertNames ? `- 庫存警示品項：${alertNames}` : '- 庫存狀態正常'}`

      const prompt = `請根據以上營運數據，用繁體中文給出：
1. 整體營運健康診斷（2～3 句）
2. 三條具體利潤優化建議（問題點 → 具體行動 → 預期效益）
3. 一個需要特別注意的財務風險
請直接輸出內容，不要加標題。`

      const result = await askGemini(prompt, context)
      setAiText(result)
    } catch {
      setAiError('分析失敗，請稍後再試。')
    } finally {
      setAiLoading(false)
    }
  }

  const profitColor = kpi.netProfit >= 0 ? 'green' : 'red'
  const now = new Date()

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* 頁首 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">營業總覽</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            萌獸探險隊 · 智慧戰情室 ·
            <span className="ml-1">{now.getFullYear()}/{String(now.getMonth()+1).padStart(2,'0')}/{String(now.getDate()).padStart(2,'0')}</span>
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${filter === f ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title={`營收（${filterLabel}）`}  value={fmt(filteredKpi.totalRevenue)} icon={<DollarSign size={20} />} color="orange" />
        <KpiCard title={`支出（${filterLabel}）`}  value={fmt(filteredKpi.totalExpense)} icon={<ShoppingBag size={20} />} color="blue" />
        <KpiCard title={`淨利（${filterLabel}）`}    value={fmt(filteredKpi.netProfit)}
          icon={filteredKpi.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />} color={filteredKpi.netProfit >= 0 ? 'green' : 'red'} />
        <KpiCard title={`利潤率（${filterLabel}）`}  value={`${filteredKpi.profitRate.toFixed(1)}%`} icon={<TrendingUp size={20} />}
          color={filteredKpi.profitRate >= 25 ? 'green' : filteredKpi.profitRate >= 15 ? 'orange' : 'red'} />
      </div>

      {/* 待撥款提示 */}
      {(linepayPending.mktCount > 0 || linepayPending.orderLinePayCount > 0 || linepayPending.ecCount > 0) && (
        <PendingPayoutBanner linepayPending={linepayPending} />
      )}

      {/* 今日銷售訂單小計 */}
      {todayOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-500 shrink-0" />
            <span className="text-sm font-semibold text-blue-800">今日銷售訂單</span>
            <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{todayOrders.length} 筆</span>
          </div>
          <span className="text-lg font-black text-blue-700">{fmt(todayOrderRevenue)}</span>
        </div>
      )}

      {/* 未來 7 天市集提醒 */}
      {upcomingEvents.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-500 rounded-xl p-2 text-white">
              <Store size={16} />
            </div>
            <h2 className="font-bold text-emerald-800">即將出攤提醒</h2>
            <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {upcomingEvents.length} 場
            </span>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map(ev => {
              const daysLeft = Math.ceil((new Date(ev.startDate) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={ev.id} className="bg-white border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{ev.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{ev.startDate}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                    ${daysLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {daysLeft === 0 ? '今天！' : `${daysLeft} 天後`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 會計待辦卡片 */}
      {(reminders.length > 0 || totalUnreported > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl p-2 text-white">
              <Bell size={16} />
            </div>
            <h2 className="font-bold text-gray-800">會計待辦</h2>
            {totalUnreported > 0 && (
              <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">
                {totalUnreported} 筆未處理
              </span>
            )}
          </div>

          {/* 稅務提醒 */}
          {reminders.length > 0 && (
            <div className="space-y-2 mb-4">
              {reminders.map(r => {
                const s = REMINDER_STYLE[r.color]
                const done = doneReminders.includes(r.id)
                return (
                  <div key={r.id} className={`${done ? 'bg-gray-50 border-gray-200 opacity-60' : `${s.bg} border ${s.border}`} border rounded-xl px-4 py-3 flex items-start gap-3 transition-all`}>
                    <span className="text-xl shrink-0 mt-0.5">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${done ? 'text-gray-400 line-through' : s.title}`}>{r.title}</span>
                        {r.urgent && !done && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>緊急</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.desc}</p>
                    </div>
                    <button onClick={() => toggleReminder(r.id)}
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'
                      }`}>
                      {done && <span className="text-xs font-bold">✓</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* 未處理統計 */}
          {totalUnreported > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-orange-500">{unreportedRev}</p>
                <p className="text-xs text-gray-500 mt-0.5">未處理營收筆數</p>
              </div>
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-blue-500">{unreportedExp}</p>
                <p className="text-xs text-gray-500 mt-0.5">未處理支出筆數</p>
              </div>
            </div>
          )}

          {reminders.length === 0 && totalUnreported === 0 && (
            <p className="text-sm text-gray-400">目前無待辦會計事項 ✅</p>
          )}
        </div>
      )}

      {/* ── 法規小助手 ── */}
      <AIAccountingAssistant />

      {/* 庫存警示 */}
      {inventoryAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <span className="font-bold text-red-700 text-sm sm:text-base">
              食材庫存警示 — {inventoryAlerts.length} 項低於安全水位
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {inventoryAlerts.map(item => (
              <div key={item.id} className="bg-white border border-red-200 rounded-xl px-4 py-2 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{item.itemName}</span>
                <span className="text-sm text-red-600 font-bold">
                  {item.currentQty} / {item.safetyQty} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 趨勢圖 */}
      <SectionCard title="營收趨勢">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={36} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="營收" stroke="#FFB84D" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="支出" stroke="#94A3B8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="淨利" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* AI 庫存健康分析 */}
      <InventoryAI inventory={inventory} revenues={revenues} />

      {/* AI 洞察 */}
      <SectionCard title="🤖 AI 營運洞察">
        <div className="space-y-3">
          {!aiText && !aiLoading && (
            <p className="text-sm text-gray-400">點擊下方按鈕，AI 將根據您的營運數據提供個人化建議。</p>
          )}
          {aiLoading && (
            <div className="flex items-center gap-3 text-orange-500">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">AI 正在分析您的數據...</span>
            </div>
          )}
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          {aiText && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {aiText}
            </div>
          )}
          <button onClick={handleAI} disabled={aiLoading}
            className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}>
            <Sparkles size={16} />
            {aiLoading ? '分析中...' : '產生 AI 洞察'}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
