import { useState, useMemo } from 'react'
import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { SectionCard, btnPrimary } from '../components/ui'
import { fmt } from '../utils/format'
import { getAIInsight } from '../utils/aiInsight'

function PnLRow({ label, value, indent = 0, bold = false, highlight, border }) {
  return (
    <div className={`flex justify-between items-center py-2.5 px-4
      ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-12' : ''}
      ${bold ? 'font-bold' : ''}
      ${highlight === 'green' ? 'bg-emerald-50 rounded-xl' : highlight === 'red' ? 'bg-red-50 rounded-xl' : ''}
      ${border ? 'border-t border-gray-200 mt-1' : ''}
    `}>
      <span className={`text-sm ${bold ? 'text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold
        ${value < 0 ? 'text-red-600' : value > 0 && highlight ? 'text-emerald-600' : 'text-gray-800'}
      `}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  )
}

export default function PnL({ data }) {
  const { revenues, expenses, kpi, inventoryAlerts } = data
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const pnl = useMemo(() => {
    const totalRev = revenues.reduce((s, r) => s + r.amount, 0)
    const ecRev = revenues.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
    const mktRev = revenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)

    const byCategory = ['食品', '烘焙', '蛋糕', '用品'].map(cat => ({
      cat, amount: revenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    }))

    const cogs = expenses.filter(e => ['進貨'].includes(e.type)).reduce((s, e) => s + e.amount, 0)
    const materialCost = expenses.filter(e => e.type === '進貨' && e.isProductionCost).reduce((s, e) => s + e.amount, 0)
    const grossProfit = totalRev - cogs

    const opExpenses = {
      rent:      expenses.filter(e => e.type === '租金').reduce((s, e) => s + e.amount, 0),
      electric:  expenses.filter(e => e.type === '電費').reduce((s, e) => s + e.amount, 0),
      labor:     expenses.filter(e => e.type === '人事').reduce((s, e) => s + e.amount, 0),
      booth:     expenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0),
      marketing: expenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0),
      material:  expenses.filter(e => e.type === '耗材').reduce((s, e) => s + e.amount, 0),
      equipment: expenses.filter(e => e.type === '設備').reduce((s, e) => s + e.amount, 0),
      misc:      expenses.filter(e => e.type === '雜項').reduce((s, e) => s + e.amount, 0),
    }
    const totalOpExp = Object.values(opExpenses).reduce((s, v) => s + v, 0)
    const netProfit = grossProfit - totalOpExp

    return { totalRev, ecRev, mktRev, byCategory, cogs, grossProfit, opExpenses, totalOpExp, netProfit }
  }, [revenues, expenses])

  async function handleAI() {
    setAiLoading(true)
    setAiText('')
    try {
      const result = await getAIInsight({ kpi, inventoryAlerts, revenues, expenses })
      setAiText(result)
    } finally {
      setAiLoading(false)
    }
  }

  const profitRate = pnl.totalRev > 0 ? (pnl.netProfit / pnl.totalRev * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">盈虧損益表</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="損益結構">
          <div className="space-y-1">
            {/* 營業收入 */}
            <PnLRow label="▌ 營業收入" value={pnl.totalRev} bold />
            <PnLRow label="電商通路" value={pnl.ecRev} indent={1} />
            <PnLRow label="市集通路" value={pnl.mktRev} indent={1} />
            {pnl.byCategory.map(({ cat, amount }) => (
              <PnLRow key={cat} label={`└ ${cat}`} value={amount} indent={2} />
            ))}

            {/* 營業成本 */}
            <PnLRow label="▌ (-) 營業成本" value={-pnl.cogs} bold border />
            <PnLRow label="進貨成本" value={-pnl.cogs} indent={1} />

            {/* 毛利 */}
            <PnLRow label="▌ 毛利" value={pnl.grossProfit} bold border
              highlight={pnl.grossProfit >= 0 ? 'green' : 'red'} />

            {/* 營業費用 */}
            <PnLRow label="▌ (-) 營業費用" value={-pnl.totalOpExp} bold border />
            <PnLRow label="租金" value={-pnl.opExpenses.rent} indent={1} />
            <PnLRow label="電費" value={-pnl.opExpenses.electric} indent={1} />
            <PnLRow label="人事" value={-pnl.opExpenses.labor} indent={1} />
            <PnLRow label="攤位費" value={-pnl.opExpenses.booth} indent={1} />
            <PnLRow label="行銷費" value={-pnl.opExpenses.marketing} indent={1} />
            <PnLRow label="耗材" value={-pnl.opExpenses.material} indent={1} />
            <PnLRow label="設備" value={-pnl.opExpenses.equipment} indent={1} />
            <PnLRow label="雜項" value={-pnl.opExpenses.misc} indent={1} />

            {/* 稅前淨利 */}
            <PnLRow label="▌ 稅前淨利" value={pnl.netProfit} bold border
              highlight={pnl.netProfit >= 0 ? 'green' : 'red'} />
          </div>
        </SectionCard>

        <div className="space-y-4">
          {/* 利潤率儀表 */}
          <SectionCard title="利潤率">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-black ${profitRate >= 25 ? 'text-emerald-500' : profitRate >= 15 ? 'text-orange-400' : 'text-red-500'}`}>
                {profitRate.toFixed(1)}%
              </div>
              <div>
                {profitRate >= 25
                  ? <div className="flex items-center gap-1 text-emerald-600 font-medium"><TrendingUp size={18} /> 健康</div>
                  : <div className="flex items-center gap-1 text-red-500 font-medium"><TrendingDown size={18} /> 需改善</div>
                }
                <p className="text-xs text-gray-400 mt-1">建議目標：≥ 25%</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${profitRate >= 25 ? 'bg-emerald-400' : profitRate >= 15 ? 'bg-orange-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }} />
            </div>
          </SectionCard>

          {/* AI 智慧建議 */}
          <SectionCard title="🤖 AI 智慧建議">
            <div className="space-y-3">
              {!aiText && !aiLoading && (
                <p className="text-sm text-gray-400">根據損益數據，AI 將提供針對性的改善建議。</p>
              )}
              {aiLoading && (
                <div className="flex items-center gap-3 text-orange-500">
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">分析中...</span>
                </div>
              )}
              {aiText && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {aiText}
                </div>
              )}
              <button onClick={handleAI} disabled={aiLoading}
                className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}>
                <Sparkles size={16} />
                {aiLoading ? '分析中...' : '產生智慧建議'}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
